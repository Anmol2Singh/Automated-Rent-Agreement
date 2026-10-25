import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffAuth } from '@/lib/auth';
import { AgreementCase } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await verifyStaffAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized staff access.' }, { status: 401 });
  }
  try {
    const agreement: AgreementCase = await req.json();

    const igrPayload = {
      header: {
        district: "Pune",
        taluka: agreement.propertyDetails.village?.toLowerCase().includes('wagholi') ? "Haveli" : "Haveli",
        village: agreement.propertyDetails.village || "Wagholi",
        tokenNo: agreement.tokenNumber,
        executionDate: agreement.financials.startDate,
      },
      property: {
        propertyType: agreement.propertyDetails.propertyType,
        buildingName: agreement.propertyDetails.buildingName,
        flatNo: agreement.propertyDetails.flatNo,
        floorNo: agreement.propertyDetails.floorNo,
        surveyNo: agreement.propertyDetails.surveyNo,
        areaSqFt: agreement.propertyDetails.areaSqFt,
        pincode: agreement.propertyDetails.pincode,
      },
      licensor: {
        fullName: agreement.landlord.fullName,
        aadhaar: agreement.landlord.aadhaar,
        pan: agreement.landlord.pan,
        address: agreement.landlord.nativeAddress,
      },
      licensees: agreement.tenants.map(t => ({
        fullName: t.fullName,
        aadhaar: t.aadhaar,
        pan: t.pan,
        address: t.nativeAddress,
      })),
      witnesses: agreement.witnesses.map(w => ({
        fullName: w.fullName,
        aadhaar: w.aadhaar,
        address: w.nativeAddress,
      })),
      financials: {
        monthlyRent: agreement.financials.rent,
        deposit: agreement.financials.deposit,
        months: agreement.financials.tenureMonths,
      }
    };

    return NextResponse.json({
      success: true,
      tokenNumber: agreement.tokenNumber,
      igrPayload,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
