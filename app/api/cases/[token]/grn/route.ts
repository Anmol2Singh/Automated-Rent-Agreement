import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseServer';
import { updateGRNInGoogleSheet } from '@/lib/sheetsExporter';

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
    const body = await req.json();
    const { grnNo, prnNo, igrPassword, receiptDate } = body;

    // Fetch existing case
    const { data: item, error: fetchErr } = await supabase
      .from('agreements')
      .select('id, grn_details')
      .eq('token_number', token)
      .single();

    if (fetchErr || !item) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }

    const updatedGrn = {
      ...(item.grn_details || {}),
      ...(grnNo ? { grnNo } : {}),
      ...(prnNo ? { prnNo } : {}),
      ...(igrPassword ? { igrPassword } : {}),
      ...(receiptDate ? { receiptDate } : {}),
    };

    // Update in Supabase
    const { error: updateErr } = await supabase
      .from('agreements')
      .update({
        grn_details: updatedGrn,
        updated_at: new Date().toISOString(),
      })
      .eq('token_number', token);

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    // Update sheet's yellow cell F
    const sheetValue = grnNo || prnNo || '';
    if (sheetValue) {
      await updateGRNInGoogleSheet(token, sheetValue);
    }

    return NextResponse.json({
      success: true,
      tokenNumber: token,
      grnDetails: updatedGrn,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
