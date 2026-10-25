import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseServer';
import { generateTokenNumber } from '@/lib/token';
import { uploadAgreementFilesToStorage } from '@/lib/storageUploader';
import { sendToGoogleSheetsWebhook } from '@/lib/sheetsExporter';
import { safeLogAgreement } from '@/lib/logger';
import { AgreementCase } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();

  try {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching agreements from database:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedCases: AgreementCase[] = (data || []).map((item: any) => ({
      id: item.id,
      tokenNumber: item.token_number,
      status: item.status,
      mobileNumber: item.mobile_number,
      landlord: item.landlord || {},
      tenants: item.tenants || [],
      witnesses: item.witnesses || [],
      propertyDetails: item.property_details || {},
      financials: item.financials || {},
      grnDetails: item.grn_details || {},
      files: item.files || {},
      syncedToSheets: item.synced_to_sheets || false,
      createdAt: item.created_at,
      updatedAt: item.updated_at || item.created_at,
    }));

    return NextResponse.json({ success: true, cases: formattedCases });
  } catch (err: any) {
    console.error('Agreements GET handler exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();

  try {
    const body = await req.json();

    // 1. Validate required fields
    const mobile = String(body.mobileNumber || '').trim();
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: 'Valid 10-digit mobile number is required.' },
        { status: 400 }
      );
    }

    const fin = body.financials || {};
    if (!fin.rent || !fin.deposit || !fin.tenureMonths || !fin.startDate) {
      return NextResponse.json(
        { success: false, error: 'Rent amount, deposit, tenure, and start date are required.' },
        { status: 400 }
      );
    }

    const landlord = body.landlord || {};
    if (!landlord.fullName?.trim() || !landlord.aadhaar?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Landlord full name and 12-digit Aadhaar number are required.' },
        { status: 400 }
      );
    }

    const tenants = body.tenants;
    if (!Array.isArray(tenants) || tenants.length === 0 || !tenants[0]?.fullName?.trim() || !tenants[0]?.aadhaar?.trim()) {
      return NextResponse.json(
        { success: false, error: 'At least one tenant with full name and Aadhaar number is required.' },
        { status: 400 }
      );
    }

    const witnesses = body.witnesses;
    if (
      !Array.isArray(witnesses) ||
      witnesses.length !== 2 ||
      !witnesses[0]?.fullName?.trim() ||
      !witnesses[0]?.aadhaar?.trim() ||
      !witnesses[1]?.fullName?.trim() ||
      !witnesses[1]?.aadhaar?.trim()
    ) {
      return NextResponse.json(
        { success: false, error: 'Exactly two witnesses with full names and Aadhaar numbers are required.' },
        { status: 400 }
      );
    }

    // 2. Generate internal token atomically in Postgres (PNE-YYYY-NNNN)
    const tokenNumber = await generateTokenNumber();
    const caseId = crypto.randomUUID();

    // 3. Upload all files to PRIVATE Supabase Storage bucket "agreement-docs"
    // Return relative storage paths (e.g. {token}/{role}-{docType}.ext), never public URLs
    const rawFiles = body.files || {};
    const storedFilePaths = await uploadAgreementFilesToStorage(tokenNumber, rawFiles);

    // Initial GRN details (stored separately from internal token)
    const initialGrnDetails = body.grnDetails || {
      tokenNo: '',
      igrPassword: '',
      grnNo: '',
      prnNo: '',
      receiptDate: '',
    };

    const newCase: AgreementCase = {
      id: caseId,
      tokenNumber,
      status: 'Docs Uploaded',
      mobileNumber: mobile,
      landlord,
      tenants,
      witnesses,
      propertyDetails: body.propertyDetails || {},
      financials: fin,
      grnDetails: initialGrnDetails,
      files: storedFilePaths,
      syncedToSheets: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 4. Insert DB row
    const { error: insertError } = await supabase.from('agreements').insert({
      id: newCase.id,
      token_number: newCase.tokenNumber,
      status: newCase.status,
      mobile_number: newCase.mobileNumber,
      landlord: newCase.landlord,
      tenants: newCase.tenants,
      witnesses: newCase.witnesses,
      property_details: newCase.propertyDetails,
      financials: newCase.financials,
      grn_details: newCase.grnDetails,
      files: newCase.files,
      synced_to_sheets: false,
      created_at: newCase.createdAt,
      updated_at: newCase.updatedAt,
    });

    if (insertError) {
      console.error('Database insert error:', insertError.message);
      return NextResponse.json(
        { success: false, error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    safeLogAgreement('CASE_CREATED', tokenNumber, landlord.fullName, landlord.aadhaar);

    // 5. Call sheet-sync (Task 3)
    let synced = false;
    try {
      const { count } = await supabase
        .from('agreements')
        .select('*', { count: 'exact', head: true });

      synced = await sendToGoogleSheetsWebhook(newCase, count || 1);

      if (synced) {
        await supabase
          .from('agreements')
          .update({ synced_to_sheets: true })
          .eq('id', newCase.id);
        newCase.syncedToSheets = true;
      }
    } catch (sheetErr) {
      console.warn('Google sheet sync attempt notice:', sheetErr);
      // Never fail the database record if sheet sync fails
    }

    // 6. Return response
    return NextResponse.json({
      success: true,
      tokenNumber: newCase.tokenNumber,
      caseData: newCase,
      syncedToSheets: synced,
    });
  } catch (err: any) {
    console.error('Exception in POST /api/agreements:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
