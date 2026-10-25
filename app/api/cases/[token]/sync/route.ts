import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseServer';
import { sendToGoogleSheetsWebhook } from '@/lib/sheetsExporter';
import { AgreementCase } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
  }

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

    const agreement: AgreementCase = {
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

    const synced = await sendToGoogleSheetsWebhook(agreement, 1);

    if (synced) {
      await supabase
        .from('agreements')
        .update({ synced_to_sheets: true, updated_at: new Date().toISOString() })
        .eq('token_number', token);
    }

    return NextResponse.json({
      success: synced,
      message: synced ? 'Successfully synced to Google Sheet' : 'Failed to sync to Google Sheet webhook',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
