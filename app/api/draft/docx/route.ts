import { NextRequest, NextResponse } from 'next/server';
import { generateLeaveAndLicenseDocx } from '@/lib/draftGenerator';
import { AgreementCase } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const agreement: AgreementCase = await req.json();
    const docBuffer = await generateLeaveAndLicenseDocx(agreement);

    return new NextResponse(new Uint8Array(docBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Rent_Agreement_${agreement.tokenNumber || 'Draft'}.docx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
