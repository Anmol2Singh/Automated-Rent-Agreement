import { NextRequest, NextResponse } from 'next/server';
import { processDocumentWithGemini } from '@/lib/documentExtractor';
import { DocType } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let fileBase64 = '';
    let mimeType = 'image/jpeg';
    let docType: DocType = 'aadhaar_front';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      fileBase64 = body.fileBase64 || '';
      mimeType = body.mimeType || 'image/jpeg';
      docType = body.docType || 'aadhaar_front';
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      docType = (formData.get('docType') as DocType) || 'aadhaar_front';

      if (file) {
        mimeType = file.type || 'image/jpeg';
        const buffer = await file.arrayBuffer();
        fileBase64 = `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
      }
    }

    if (!fileBase64) {
      return NextResponse.json(
        {
          fields: {},
          confidence: 0,
          warnings: ['No document file provided for extraction.'],
        },
        { status: 400 }
      );
    }

    const validDocTypes: DocType[] = ['aadhaar_front', 'aadhaar_back', 'pan', 'electricity_bill'];
    if (!validDocTypes.includes(docType)) {
      return NextResponse.json(
        {
          fields: {},
          confidence: 0,
          warnings: [`Invalid docType: ${docType}. Must be one of: ${validDocTypes.join(', ')}`],
        },
        { status: 400 }
      );
    }

    const result = await processDocumentWithGemini(fileBase64, mimeType, docType);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error in /api/extract:', err);
    return NextResponse.json(
      {
        fields: {},
        confidence: 0,
        warnings: [err?.message || 'Server extraction error occurred.'],
      },
      { status: 500 }
    );
  }
}
