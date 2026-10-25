import { getServiceSupabase } from './supabaseServer';

const BUCKET_NAME = 'agreement-docs';

function getFileExtension(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

function parseBase64(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  }
  // If raw base64 without data URI prefix
  if (dataUrl.length > 50 && !dataUrl.includes('://')) {
    return {
      mimeType: 'image/jpeg',
      buffer: Buffer.from(dataUrl, 'base64'),
    };
  }
  return null;
}

export async function uploadAgreementFilesToStorage(
  tokenNumber: string,
  rawFiles: any
): Promise<Record<string, any>> {
  const supabase = getServiceSupabase();
  const storedPaths: Record<string, any> = {};

  // Ensure private bucket exists
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 20 * 1024 * 1024,
      });
    }
  } catch (bucketErr) {
    console.warn('Storage bucket check notice:', bucketErr);
  }

  const uploadSingle = async (roleDoc: string, base64Str?: string): Promise<string | undefined> => {
    if (!base64Str) return undefined;
    const parsed = parseBase64(base64Str);
    if (!parsed) return undefined;

    const ext = getFileExtension(parsed.mimeType);
    const storagePath = `${tokenNumber}/${roleDoc}.${ext}`;

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, parsed.buffer, {
          contentType: parsed.mimeType,
          upsert: true,
        });

      if (error) {
        console.warn(`Failed to upload ${storagePath} to private bucket:`, error.message);
        return undefined;
      }

      // Return relative storage path (never public URL)
      return storagePath;
    } catch (err: any) {
      console.warn(`Upload exception for ${storagePath}:`, err?.message || err);
      return undefined;
    }
  };

  if (rawFiles.landlordAadhaarFront) {
    const path = await uploadSingle('landlord-aadhaar_front', rawFiles.landlordAadhaarFront);
    if (path) storedPaths.landlordAadhaarFront = path;
  }
  if (rawFiles.landlordAadhaarBack) {
    const path = await uploadSingle('landlord-aadhaar_back', rawFiles.landlordAadhaarBack);
    if (path) storedPaths.landlordAadhaarBack = path;
  }
  if (rawFiles.landlordPan) {
    const path = await uploadSingle('landlord-pan', rawFiles.landlordPan);
    if (path) storedPaths.landlordPan = path;
  }

  // Multi-tenant files
  if (Array.isArray(rawFiles.tenantAadhaarFront)) {
    storedPaths.tenantAadhaarFront = [];
    for (let i = 0; i < rawFiles.tenantAadhaarFront.length; i++) {
      const p = await uploadSingle(`tenant_${i + 1}-aadhaar_front`, rawFiles.tenantAadhaarFront[i]);
      storedPaths.tenantAadhaarFront.push(p || '');
    }
  }
  if (Array.isArray(rawFiles.tenantAadhaarBack)) {
    storedPaths.tenantAadhaarBack = [];
    for (let i = 0; i < rawFiles.tenantAadhaarBack.length; i++) {
      const p = await uploadSingle(`tenant_${i + 1}-aadhaar_back`, rawFiles.tenantAadhaarBack[i]);
      storedPaths.tenantAadhaarBack.push(p || '');
    }
  }
  if (Array.isArray(rawFiles.tenantPan)) {
    storedPaths.tenantPan = [];
    for (let i = 0; i < rawFiles.tenantPan.length; i++) {
      const p = await uploadSingle(`tenant_${i + 1}-pan`, rawFiles.tenantPan[i]);
      storedPaths.tenantPan.push(p || '');
    }
  }

  // Witness files
  if (rawFiles.witness1AadhaarFront) {
    const path = await uploadSingle('witness_1-aadhaar_front', rawFiles.witness1AadhaarFront);
    if (path) storedPaths.witness1AadhaarFront = path;
  }
  if (rawFiles.witness1AadhaarBack) {
    const path = await uploadSingle('witness_1-aadhaar_back', rawFiles.witness1AadhaarBack);
    if (path) storedPaths.witness1AadhaarBack = path;
  }
  if (rawFiles.witness2AadhaarFront) {
    const path = await uploadSingle('witness_2-aadhaar_front', rawFiles.witness2AadhaarFront);
    if (path) storedPaths.witness2AadhaarFront = path;
  }
  if (rawFiles.witness2AadhaarBack) {
    const path = await uploadSingle('witness_2-aadhaar_back', rawFiles.witness2AadhaarBack);
    if (path) storedPaths.witness2AadhaarBack = path;
  }

  // Electricity bill
  if (rawFiles.electricityBill) {
    const path = await uploadSingle('property-electricity_bill', rawFiles.electricityBill);
    if (path) storedPaths.electricityBill = path;
  }

  return storedPaths;
}
