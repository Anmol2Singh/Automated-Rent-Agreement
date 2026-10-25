import { NextRequest, NextResponse } from 'next/server';
import { exportAgreementsToExcelBuffer } from '@/lib/sheetsExporter';
import { verifyStaffAuth } from '@/lib/auth';
import { AgreementCase } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await verifyStaffAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized staff access.' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const cases: AgreementCase[] = body.cases || [];

    const excelBuffer = await exportAgreementsToExcelBuffer(cases);

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rent_Agreement_Ledger_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
