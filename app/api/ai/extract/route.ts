import { NextRequest, NextResponse } from 'next/server';
import { extractDocumentData } from '@/lib/geminiOcr';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileBase64, mimeType, docCategory } = body;

    if (!fileBase64 || !docCategory) {
      return NextResponse.json({ success: false, error: 'Missing fileBase64 or docCategory' }, { status: 400 });
    }

    const extracted = await extractDocumentData(fileBase64, mimeType || 'image/jpeg', docCategory);

    return NextResponse.json({
      success: true,
      extracted,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
