import ExcelJS from 'exceljs';
import { AgreementCase } from '@/types';

export interface AgreementBlockRow {
  srNo?: string;
  rent?: string;
  deposit?: string;
  tenure?: string;
  date?: string;
  propertyType?: string;
  flatNo?: string;
  area?: string;
  ownerName?: string;
  ownerAadhaar?: string;
  ownerPan?: string;
  ownerAge?: string;
  ownerMobile?: string;
  ownerAddress?: string;
  witness1Name?: string;
  witness1Aadhaar?: string;
  witness1Age?: string;
  witness1Address?: string;
  witness2Name?: string;
  witness2Aadhaar?: string;
  witness2Age?: string;
  witness2Address?: string;
  grn?: string;
  receiptDate?: string;
  propertyAddress?: string;
  tenants?: string[];
}

/**
 * Builds the exact 7-row block per agreement according to agency ledger specification:
 * Row 0 (green): A=srNo, B=date, C=landlord name, D=witness 1 name, E=witness 2 name, F=GRN/PRN (yellow), G=receipt date, H=blank, I/J/K=tenant names
 * Row 1: A=rent, B=property type, C=landlord Aadhaar, D=witness 1 Aadhaar, E=witness 2 Aadhaar, I/J/K=tenant Aadhaar
 * Row 2: A=deposit, B=flat/room/shop no, C=landlord PAN, I/J/K=tenant PAN
 * Row 3: A=tenure (e.g. 11M), B=area (e.g. 600sq.ft), C=landlord age (e.g. 42y), D/E=witness age, I/J/K=tenant age (e.g. 26y)
 * Row 4: C=landlord mobile, I/J/K=tenant mobile
 * Row 5: blank
 * Row 6 (tall, wrap text): C=landlord address, D=witness 1 address, E=witness 2 address, H=property full address, I/J/K=tenant addresses
 */
export function buildAgreement7RowBlock(agreement: AgreementCase, srNo: number = 1): AgreementBlockRow[] {
  const landlord = agreement.landlord || ({} as any);
  const tenants = agreement.tenants || [];
  const witness1 = agreement.witnesses?.[0] || ({} as any);
  const witness2 = agreement.witnesses?.[1] || ({} as any);
  const prop = agreement.propertyDetails || ({} as any);
  const fin = agreement.financials || ({} as any);
  const grn = agreement.grnDetails || ({} as any);

  const formatAge = (age?: string | number) => (age ? `${age}y` : '');
  const formatTenure = (months?: number) => (months ? `${months}M` : '11M');
  const formatArea = (area?: string) => (area ? `${area}sq.ft` : '250sq.ft');

  const fullPropertyAddress = [
    prop.surveyNo ? `Survey/Gat: ${prop.surveyNo}` : '',
    prop.buildingName,
    prop.flatNo ? `Flat: ${prop.flatNo}` : '',
    prop.floorNo ? `Floor: ${prop.floorNo}` : '',
    prop.landmark ? `Near ${prop.landmark}` : '',
    prop.village || 'Pune',
    prop.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  // Row 0
  const row0: AgreementBlockRow = {
    srNo: String(srNo),
    date: fin.startDate || new Date().toISOString().split('T')[0],
    ownerName: landlord.fullName || '',
    witness1Name: witness1.fullName || '',
    witness2Name: witness2.fullName || '',
    grn: grn.grnNo || grn.prnNo || grn.tokenNo || '',
    receiptDate: grn.receiptDate || '',
    propertyAddress: '',
    tenants: tenants.map((t) => t.fullName || ''),
  };

  // Row 1
  const row1: AgreementBlockRow = {
    rent: fin.rent ? String(fin.rent) : '0',
    propertyType: prop.propertyType || 'Flat',
    ownerAadhaar: landlord.aadhaar || '',
    witness1Aadhaar: witness1.aadhaar || '',
    witness2Aadhaar: witness2.aadhaar || '',
    tenants: tenants.map((t) => t.aadhaar || ''),
  };

  // Row 2
  const row2: AgreementBlockRow = {
    deposit: fin.deposit ? String(fin.deposit) : '0',
    flatNo: prop.flatNo ? `Flat ${prop.flatNo}` : prop.buildingName || '',
    ownerPan: landlord.pan || '',
    tenants: tenants.map((t) => t.pan || ''),
  };

  // Row 3
  const row3: AgreementBlockRow = {
    tenure: formatTenure(fin.tenureMonths),
    area: formatArea(prop.areaSqFt),
    ownerAge: formatAge(landlord.age),
    witness1Age: formatAge(witness1.age),
    witness2Age: formatAge(witness2.age),
    tenants: tenants.map((t) => formatAge(t.age)),
  };

  // Row 4
  const row4: AgreementBlockRow = {
    ownerMobile: landlord.mobile || agreement.mobileNumber || '',
    tenants: tenants.map((t) => t.mobile || ''),
  };

  // Row 5: blank
  const row5: AgreementBlockRow = {
    tenants: [],
  };

  // Row 6 (tall, wrap text)
  const row6: AgreementBlockRow = {
    ownerAddress: landlord.nativeAddress || '',
    witness1Address: witness1.nativeAddress || '',
    witness2Address: witness2.nativeAddress || '',
    propertyAddress: fullPropertyAddress,
    tenants: tenants.map((t) => t.nativeAddress || ''),
  };

  return [row0, row1, row2, row3, row4, row5, row6];
}

export async function sendToGoogleSheetsWebhook(
  agreement: AgreementCase,
  srNo: number = 1
): Promise<boolean> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('GOOGLE_SHEETS_WEBHOOK_URL is not configured.');
    return false;
  }

  try {
    const block = buildAgreement7RowBlock(agreement, srNo);
    const payload = {
      action: 'APPEND_BLOCK',
      tokenNumber: agreement.tokenNumber,
      srNo,
      block,
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`Google Sheets Webhook returned HTTP ${res.status}`);
      return false;
    }

    const json = await res.json().catch(() => ({}));
    return json.result === 'success';
  } catch (err: any) {
    console.error('Error sending agreement to Google Sheets Webhook:', err?.message || err);
    return false;
  }
}

export async function updateGRNInGoogleSheet(
  tokenNumber: string,
  grnNo: string,
  srNo?: number
): Promise<boolean> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const payload = {
      action: 'UPDATE_GRN',
      tokenNumber,
      grnNo,
      srNo,
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to update GRN in Google Sheet:', err);
    return false;
  }
}

export async function exportAgreementsToExcelBuffer(agreements: AgreementCase[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pune Rent Agreement Agency';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Rent Agreements Queue', {
    properties: { defaultRowHeight: 20 },
  });

  const columns = [
    { header: 'Sr. No./Rent/Dep./Tennure', key: 'colA', width: 22 },
    { header: 'Date/Flat/Shop No./fee', key: 'colB', width: 20 },
    { header: "Owner's Name & Address", key: 'colC', width: 34 },
    { header: 'witness 1', key: 'colD', width: 28 },
    { header: 'witness 2', key: 'colE', width: 28 },
    { header: 'Token No/Pwd/GRN/PRN(DHC)', key: 'colF', width: 26 },
    { header: 'Since/Date of receipt', key: 'colG', width: 20 },
    { header: 'Properties Address', key: 'colH', width: 42 },
    { header: "No.1,Tenant's Name,Address", key: 'colI', width: 34 },
    { header: "No.2,Tenant's Name,Address", key: 'colJ', width: 34 },
    { header: "No.3,Tenant's Name,Address", key: 'colK', width: 34 },
    { header: "No.4,Tenant's Name,Address", key: 'colL', width: 34 },
  ];

  worksheet.columns = columns;

  // Header row style (Row 1 of worksheet)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 24;
  headerRow.font = { bold: true, color: { argb: 'FF1F2937' }, size: 10 };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  agreements.forEach((agreement, agIdx) => {
    const block = buildAgreement7RowBlock(agreement, agIdx + 1);

    block.forEach((item, rIdx) => {
      const tenants = item.tenants || [];
      const rowValues = [
        item.srNo || item.rent || item.deposit || item.tenure || '',
        item.date || item.propertyType || item.flatNo || item.area || '',
        item.ownerName || item.ownerAadhaar || item.ownerPan || item.ownerAge || item.ownerMobile || item.ownerAddress || '',
        item.witness1Name || item.witness1Aadhaar || item.witness1Age || item.witness1Address || '',
        item.witness2Name || item.witness2Aadhaar || item.witness2Age || item.witness2Address || '',
        item.grn || '',
        item.receiptDate || '',
        item.propertyAddress || '',
        tenants[0] || '',
        tenants[1] || '',
        tenants[2] || '',
        tenants[3] || '',
      ];

      const row = worksheet.addRow(rowValues);

      // Plain text formatting for every cell to prevent scientific notation
      row.eachCell((cell) => {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'middle' };
      });

      // Row 0: Header row of agreement block - Light Green
      if (rIdx === 0) {
        row.height = 22;
        row.font = { bold: true, color: { argb: 'FF0F5132' } };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB6D7A8' }, // Green header
        };

        // Highlight Cell F (GRN/PRN) in Yellow
        const cellF = row.getCell(6);
        cellF.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF2CC' }, // Yellow GRN
        };
      }

      // Row 6: Tall, wrap text for addresses
      if (rIdx === 6) {
        row.height = 65;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'top', wrapText: true };
        });
      }
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
