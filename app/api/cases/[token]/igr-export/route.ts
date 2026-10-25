import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseServer';
import { splitNameMaharashtrian, deriveSalutation } from '@/lib/documentExtractor';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    const { data: item, error } = await supabase
      .from('agreements')
      .select('*')
      .eq('token_number', token)
      .single();

    if (error || !item) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }

    const prop = item.property_details || {};
    const landlord = item.landlord || {};
    const tenantsList = Array.isArray(item.tenants) ? item.tenants : [];
    const witnessList = Array.isArray(item.witnesses) ? item.witnesses : [];

    const formatPerson = (p: any, defaultSalutation: string = 'Mr') => {
      const nameParts = p.name_en || splitNameMaharashtrian(p.fullName || '');
      const addr = p.address_en || {};
      return {
        surname: nameParts.surname || '',
        first: nameParts.first || p.fullName?.split(' ')[0] || '',
        middle: nameParts.middle || '',
        age: p.age ? String(p.age).replace(/\D/g, '') : '',
        gender: p.gender || 'Male',
        salutation: p.salutation || deriveSalutation(p.gender),
        pan: p.pan || '',
        contact: p.mobile || '',
        email: p.email || '',
        address: {
          building: addr.building || '',
          flatNo: addr.flat_no || '',
          floorNo: addr.floor_no || '',
          road: addr.road || '',
          location: addr.location || '',
          pincode: addr.pincode || '',
          villageCity: addr.village_city || '',
          district: addr.district || 'Pune',
          state: addr.state || 'Maharashtra',
        },
      };
    };

    const ownerData = {
      partyNumber: 1,
      partyType: 'licensor/Owner',
      entityType: 'Individual',
      ...formatPerson(landlord, 'Mr'),
      executing: 'Self',
      documentPresentor: true,
    };

    const tenantsData = tenantsList.map((t: any, idx: number) => ({
      partyNumber: idx + 2,
      partyType: 'licencee/Tenant',
      entityType: 'Individual',
      ...formatPerson(t, 'Mr'),
      executing: 'Self',
      documentPresentor: false,
    }));

    const identifiersData = witnessList.slice(0, 2).map((w: any, idx: number) => ({
      identifierNumber: idx + 1,
      forWhichParty: 'All Parties',
      ...formatPerson(w, 'Mr'),
    }));

    const igrPayload = {
      tokenNo: item.token_number,
      property: {
        district: prop.district || 'Pune',
        taluka: prop.taluka || 'Haveli',
        village: prop.village_igr || prop.village || 'Wagholi',
        propertyInArea: prop.area_type || 'Urban',
        localLimitType: prop.local_limit_type || 'Corporation',
        localLimitName: prop.local_limit_name || 'Pune',
        zp: '',
        attribute1Type: prop.attribute1_type || 'Survey Number',
        attribute1Number: prop.attribute1_number || prop.surveyNo || '',
        attribute2Type: prop.attribute2_type || '',
        attribute2Number: prop.attribute2_number || '',
        unitType: prop.unit_type || 'Apartment/Flat',
        unitArea: prop.unit_area || prop.areaSqFt || '250',
        unitAreaUom: prop.unit_area_uom || 'Square Feet',
        building: prop.building_en || prop.buildingName || '',
        flatNo: prop.flat_no_en || prop.flatNo || '',
        floorNo: prop.floor_no_en || prop.floorNo || '',
        road: prop.road_en || prop.road || '',
        location: prop.location_en || prop.landmark || '',
        use: prop.use || 'Residential',
        galleryArea: prop.gallery_area || '0',
        galleryAreaUom: 'Square Meter',
        parkingArea: prop.parking_area || '0',
        parkingAreaUom: 'Square Meter',
        policeStation: prop.police_station || '',
      },
      owner: ownerData,
      tenants: tenantsData,
      identifiers: identifiersData,
    };

    return NextResponse.json({
      success: true,
      tokenNumber: item.token_number,
      igrPayload,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
