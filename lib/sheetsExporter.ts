import * as XLSX from 'xlsx';
import { AgreementCase } from '../types';
import { calculateTotalAgreementFee } from './calculator';

export function formatAgencyLedgerRow(agreement: AgreementCase, srNo: number = 1) {
  const landlord = agreement.landlord || {};
  const tenants = agreement.tenants || [];
  const witness1 = agreement.witnesses[0] || {};
  const witness2 = agreement.witnesses[1] || {};
  const prop = agreement.propertyDetails || {};
  const fin = agreement.financials || {};
  const grn = agreement.grnDetails || {};

  const totalFee = fin.fee || calculateTotalAgreementFee(fin.rent || 0, fin.deposit || 0, fin.tenureMonths || 11).totalAmount;

  // Col 1: Sr. No. / Rent / Deposit / Tenure / Area
  const col1 = [
    `${srNo}`,
    `${fin.rent || 0}`,
    `${fin.deposit || 0}`,
    `${fin.tenureMonths || 11}m`,
    `${prop.areaSqFt || 250}sqft`
  ].join('\n');

  // Col 2: Date / Flat/Shop No / fee
  const col2 = [
    fin.startDate || new Date().toLocaleDateString('en-IN'),
    `${prop.flatNo || 'Flat No. 1'}`,
    `Fee: ${totalFee}`
  ].join('\n');

  // Col 3: Owner's Name & Address
  const col3 = [
    landlord.fullName || 'Landlord Name',
    landlord.aadhaar || landlord.mobile || '',
    landlord.pan || '',
    landlord.age ? `${landlord.age}` : '',
    landlord.mobile || '',
    landlord.nativeAddress || ''
  ].filter(Boolean).join('\n');

  // Col 4: Witness 1
  const col4 = [
    witness1.fullName || '',
    witness1.aadhaar || witness1.mobile || '',
    witness1.age ? `${witness1.age}` : '',
    witness1.nativeAddress || ''
  ].filter(Boolean).join('\n');

  // Col 5: Witness 2
  const col5 = [
    witness2.fullName || '',
    witness2.aadhaar || witness2.mobile || '',
    witness2.age ? `${witness2.age}` : '',
    witness2.nativeAddress || ''
  ].filter(Boolean).join('\n');

  // Col 6: Token No / Pwd / GRN / PRN(DHC)
  const col6 = [
    agreement.tokenNumber || '',
    grn.igrPassword || 'MH007372620202627P',
    grn.grnNo || grn.prnNo || '0726305705334'
  ].filter(Boolean).join('\n');

  // Col 7: Since / Date of receipt
  const col7 = fin.startDate || new Date().toLocaleDateString('en-IN');

  // Col 8: Properties Address
  const col8 = [
    `${prop.buildingName || ''}, ${prop.flatNo || ''}, ${prop.floorNo || ''}`,
    `Landmark: ${prop.landmark || ''}`,
    `${prop.village || ''}, Pune ${prop.pincode || '412207'}`
  ].filter(Boolean).join(', ');

  // Columns 9 to 12: Tenants 1 through 4
  const formatTenantCell = (tIdx: number) => {
    const t = tenants[tIdx];
    if (!t) return '';
    return [
      t.fullName || '',
      t.aadhaar || t.mobile || '',
      t.pan || '',
      t.age ? `${t.age}` : '',
      t.nativeAddress || ''
    ].filter(Boolean).join('\n');
  };

  return {
    "Sr. No./Rent/Dep./Tennure": col1,
    "Date/Flat/Shop No./fee": col2,
    "Owner's Name & Address": col3,
    "witness 1": col4,
    "witness 2": col5,
    "Token No/Pwd/GRN/PRN(DHC)": col6,
    "Since/Date of receipt": col7,
    "Properties Address": col8,
    "No.1,Tenant's Name,Address": formatTenantCell(0),
    "No.2,Tenant's Name,Address": formatTenantCell(1),
    "No.3,Tenant's Name,Address": formatTenantCell(2),
    "No.4,Tenant's Name,Address": formatTenantCell(3),
  };
}

export function exportAgreementsToExcelBuffer(agreements: AgreementCase[]): Buffer {
  const rows = agreements.map((ag, idx) => formatAgencyLedgerRow(ag, idx + 1));
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const colWidths = [
    { wch: 18 }, // Sr. No./Rent...
    { wch: 18 }, // Date/Flat...
    { wch: 35 }, // Owner
    { wch: 30 }, // Witness 1
    { wch: 30 }, // Witness 2
    { wch: 25 }, // Token No...
    { wch: 18 }, // Date receipt
    { wch: 40 }, // Property
    { wch: 35 }, // Tenant 1
    { wch: 35 }, // Tenant 2
    { wch: 35 }, // Tenant 3
    { wch: 35 }, // Tenant 4
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rent Agreements Queue");

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function sendToGoogleSheetsWebhook(agreement: AgreementCase, srNo: number = 1): Promise<boolean> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("GOOGLE_SHEETS_WEBHOOK_URL is not configured.");
    return false;
  }

  try {
    const payload = formatAgencyLedgerRow(agreement, srNo);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (err) {
    console.error("Error sending row to Google Sheets Webhook:", err);
    return false;
  }
}
