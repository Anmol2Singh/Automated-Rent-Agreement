import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { AgreementCase } from '../types';

export async function generateLeaveAndLicenseDocx(agreement: AgreementCase): Promise<Buffer> {
  const landlordName = agreement.landlord.fullName || '____________________';
  const landlordAadhaar = agreement.landlord.aadhaar || '____________';
  const landlordPan = agreement.landlord.pan || '____________';
  const landlordAddress = agreement.landlord.nativeAddress || '____________________';

  const tenantTextRuns = agreement.tenants.map((t, idx) => {
    return new Paragraph({
      children: [
        new TextRun({ text: `Tenant #${idx + 1}: `, bold: true }),
        new TextRun({ text: `${t.fullName || 'N/A'}, Aadhaar No: ${t.aadhaar || 'N/A'}, PAN: ${t.pan || 'N/A'}, Residing at: ${t.nativeAddress || 'N/A'}` }),
      ],
      spacing: { after: 120 },
    });
  });

  const witness1 = agreement.witnesses[0] || { fullName: 'N/A', aadhaar: 'N/A', nativeAddress: 'N/A' };
  const witness2 = agreement.witnesses[1] || { fullName: 'N/A', aadhaar: 'N/A', nativeAddress: 'N/A' };

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "LEAVE AND LICENSE AGREEMENT",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Token Number: ${agreement.tokenNumber}`, bold: true, size: 24, color: "15803D" }),
              new TextRun({ text: ` | Date: ${agreement.financials.startDate || new Date().toLocaleDateString('en-IN')}`, size: 20 }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `This Leave and License Agreement is made and executed at Pune, Maharashtra on this day of ${new Date().toLocaleDateString('en-IN')}, by and between:`,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: "1. LICENSOR (OWNER / LANDLORD):",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${landlordName}`, bold: true }),
              new TextRun({ text: `, Age: ${agreement.landlord.age || 'Adult'}, Aadhaar No: ${landlordAadhaar}, PAN: ${landlordPan}, Permanent Address: ${landlordAddress}. (Hereinafter referred to as the 'LICENSOR').` }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: "2. LICENSEE(S) (TENANT / RENTER):",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 },
          }),
          ...tenantTextRuns,
          new Paragraph({
            text: "3. SCHEDULE OF LICENSED PROPERTY:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `All that piece and parcel of ${agreement.propertyDetails.propertyType || 'Flat'}, bearing ${agreement.propertyDetails.flatNo || 'Unit'}, ${agreement.propertyDetails.floorNo || 'Floor'}, in Building/Society '${agreement.propertyDetails.buildingName}', Survey/Gat No: ${agreement.propertyDetails.surveyNo || 'N/A'}, Area: ${agreement.propertyDetails.areaSqFt || 'N/A'} Sq.Ft., Situated at ${agreement.propertyDetails.village}, Landmark: ${agreement.propertyDetails.landmark}, Pune - ${agreement.propertyDetails.pincode}, Maharashtra.`,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: "4. TERMS AND FINANCIAL CONSIDERATION:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Tenure Duration: ", bold: true }),
              new TextRun({ text: `${agreement.financials.tenureMonths || 11} Months commencing from ${agreement.financials.startDate}.\n` }),
              new TextRun({ text: "• Monthly License Fee / Rent: ", bold: true }),
              new TextRun({ text: `₹ ${agreement.financials.rent} /- (Rupees ${agreement.financials.rent} per month).\n` }),
              new TextRun({ text: "• Security Deposit: ", bold: true }),
              new TextRun({ text: `₹ ${agreement.financials.deposit} /- (Refundable interest-free deposit).\n` }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: "5. WITNESSES:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Witness 1: ", bold: true }),
              new TextRun({ text: `${witness1.fullName}, Aadhaar: ${witness1.aadhaar}, Address: ${witness1.nativeAddress}\n` }),
              new TextRun({ text: "Witness 2: ", bold: true }),
              new TextRun({ text: `${witness2.fullName}, Aadhaar: ${witness2.aadhaar}, Address: ${witness2.nativeAddress}` }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "IN WITNESS WHEREOF the Licensor and Licensee(s) have set their hands and signature on this agreement in the presence of the above-named witnesses.",
                italics: true,
              }),
            ],
            spacing: { after: 400 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
