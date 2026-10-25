import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { generateTokenNumber } from '@/lib/token';
import { sendToGoogleSheetsWebhook } from '@/lib/sheetsExporter';
import { AgreementCase } from '@/types';

export const dynamic = 'force-dynamic';

// Global mock memory store for immediate local testing if Supabase DB is uninitialized
const localMemoryAgreements: AgreementCase[] = [];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('agreements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      // Map DB snake_case columns to camelCase object
      const formattedCases: AgreementCase[] = data.map((item: any) => ({
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
    }

    return NextResponse.json({ success: true, cases: localMemoryAgreements });
  } catch (err) {
    return NextResponse.json({ success: true, cases: localMemoryAgreements });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tokenNumber = await generateTokenNumber();
    const generatedId = crypto.randomUUID();

    const newCase: AgreementCase = {
      id: generatedId,
      tokenNumber,
      status: body.status || 'AI Processing',
      mobileNumber: body.mobileNumber || '',
      landlord: body.landlord || { fullName: '', aadhaar: '', nativeAddress: '' },
      tenants: body.tenants || [{ fullName: '', aadhaar: '', nativeAddress: '' }],
      witnesses: body.witnesses || [
        { fullName: '', aadhaar: '', nativeAddress: '' },
        { fullName: '', aadhaar: '', nativeAddress: '' },
      ],
      propertyDetails: body.propertyDetails || {
        propertyType: 'Flat',
        buildingName: '',
        flatNo: '',
        floorNo: '',
        surveyNo: '',
        areaSqFt: '250',
        road: '',
        landmark: '',
        village: 'Wagholi',
        city: 'Pune',
        pincode: '412207',
      },
      financials: body.financials || {
        rent: 5000,
        deposit: 15000,
        tenureMonths: 11,
        startDate: new Date().toISOString().split('T')[0],
        fee: 1000,
      },
      grnDetails: {
        tokenNo: tokenNumber,
        igrPassword: `MH${Math.floor(100000000000 + Math.random() * 900000000000)}P`,
        grnNo: `07263${Math.floor(10000000 + Math.random() * 90000000)}`,
        receiptDate: new Date().toISOString().split('T')[0],
      },
      files: body.files || {},
      syncedToSheets: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Auto-sync to Google Sheets Webhook if configured
    const synced = await sendToGoogleSheetsWebhook(newCase, localMemoryAgreements.length + 1);
    newCase.syncedToSheets = synced;

    // Attempt Supabase insert
    try {
      const { error } = await supabase.from('agreements').insert({
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
        synced_to_sheets: synced,
        created_at: newCase.createdAt,
      });

      if (error) {
        console.warn("Supabase DB insert notice:", error.message);
      } else {
        console.log(`✅ Saved agreement ${tokenNumber} to Supabase database!`);
      }
    } catch (dbErr) {
      console.warn("Supabase DB store offline, using in-memory store", dbErr);
    }

    // Always append to local memory store
    localMemoryAgreements.unshift(newCase);

    return NextResponse.json({
      success: true,
      tokenNumber: newCase.tokenNumber,
      caseData: newCase,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
