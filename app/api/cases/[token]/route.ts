import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseServer';
import { verifyStaffAuth } from '@/lib/auth';
import { AgreementCase } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const auth = await verifyStaffAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized staff access.' }, { status: 401 });
  }

  const token = params.token;
  const supabase = getServiceSupabase();

  try {
    const { data: item, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('token_number', token)
      .single();

    if (error || !item) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }

    const formattedCase: AgreementCase = {
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
      updatedAt: item.updated_at,
    };

    return NextResponse.json({ success: true, caseData: formattedCase });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const auth = await verifyStaffAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized staff access.' }, { status: 401 });
  }

  const token = params.token;
  const supabase = getServiceSupabase();

  try {
    const body = await req.json();

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updateFields.status = body.status;
    if (body.mobileNumber !== undefined) updateFields.mobile_number = body.mobileNumber;
    if (body.landlord !== undefined) updateFields.landlord = body.landlord;
    if (body.tenants !== undefined) updateFields.tenants = body.tenants;
    if (body.witnesses !== undefined) updateFields.witnesses = body.witnesses;
    if (body.propertyDetails !== undefined) updateFields.property_details = body.propertyDetails;
    if (body.financials !== undefined) updateFields.financials = body.financials;
    if (body.grnDetails !== undefined) updateFields.grn_details = body.grnDetails;
    if (body.syncedToSheets !== undefined) updateFields.synced_to_sheets = body.syncedToSheets;

    const { data, error } = await supabase
      .from('agreements')
      .update(updateFields)
      .eq('token_number', token)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, caseData: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
