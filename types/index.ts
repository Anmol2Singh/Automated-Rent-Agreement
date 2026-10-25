export type PartyType = 'Landlord' | 'Tenant' | 'Witness';

export interface NameSplit {
  surname: string;
  first: string;
  middle: string;
}

export interface AddressSplit {
  building?: string;
  flat_no?: string;
  floor_no?: string;
  road?: string;
  location?: string;
  pincode?: string;
  village_city?: string;
  district?: string;
  state?: string;
}

export interface Party {
  id?: string;
  type: PartyType;
  fullName: string;
  name_en?: NameSplit;
  salutation?: 'Mr' | 'Mrs' | 'Miss' | string;
  aadhaar: string;
  pan?: string;
  mobile?: string;
  email?: string;
  age?: string;
  gender?: string;
  dob?: string;
  nativeAddress: string;
  address_en?: AddressSplit;
  confidenceScore?: number;
  aiFields?: Record<string, boolean>;
  unverifiedFields?: Record<string, boolean>;
}

export interface PropertyDetails {
  propertyType: 'Flat' | 'Room' | 'Shop';
  buildingName: string;
  flatNo: string;
  floorNo: string;
  surveyNo: string;
  areaSqFt: string;
  road: string;
  landmark: string;
  village: string;
  city: string;
  pincode: string;
  furnitureDetails?: string;

  // IGR Property Fields (English only, no Marathi)
  district?: string;
  taluka?: string;
  village_igr?: string;
  area_type?: string;
  local_limit_type?: string;
  local_limit_name?: string;
  zp?: string;
  attribute1_type?: string;
  attribute1_number?: string;
  attribute2_type?: string;
  attribute2_number?: string;
  unit_type?: string;
  unit_area?: string;
  unit_area_uom?: string;
  building_en?: string;
  flat_no_en?: string;
  floor_no_en?: string;
  road_en?: string;
  location_en?: string;
  use?: string;
  gallery_area?: string;
  gallery_area_uom?: string;
  parking_area?: string;
  parking_area_uom?: string;
  police_station?: string;
}

export interface Financials {
  rent: number;
  deposit: number;
  tenureMonths: number;
  startDate: string;
  fee?: number;
}

export interface GRNDetails {
  tokenNo?: string;
  igrPassword?: string;
  grnNo?: string;
  prnNo?: string;
  receiptDate?: string;
}

export type CaseStatus =
  | 'Docs Uploaded'
  | 'AI Processing'
  | 'Verification Required'
  | 'Draft Ready'
  | 'Biometrics Scheduled'
  | 'Completed';

export interface AgreementCase {
  id: string;
  tokenNumber: string;
  status: CaseStatus;
  mobileNumber: string;
  landlord: Party;
  tenants: Party[];
  witnesses: Party[];
  propertyDetails: PropertyDetails;
  financials: Financials;
  grnDetails: GRNDetails;
  files: {
    landlordAadhaarFront?: string;
    landlordAadhaarBack?: string;
    landlordPan?: string;
    tenantAadhaarFront?: string[];
    tenantAadhaarBack?: string[];
    tenantPan?: string[];
    witness1AadhaarFront?: string;
    witness1AadhaarBack?: string;
    witness2AadhaarFront?: string;
    witness2AadhaarBack?: string;
    electricityBill?: string;
    draftDocxPath?: string;
  };
  syncedToSheets?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DocType = 'aadhaar_front' | 'aadhaar_back' | 'pan' | 'electricity_bill';

export interface ExtractionResult {
  fields: {
    fullName?: string;
    name_en?: NameSplit;
    aadhaarNumber?: string;
    panNumber?: string;
    dob?: string;
    age?: string;
    gender?: string;
    salutation?: string;
    fatherHusbandName?: string;
    nativeAddress?: string;
    address_en?: AddressSplit;
    consumerName?: string;
    buildingName?: string;
    flatNo?: string;
    floorNo?: string;
    village?: string;
    surveyNo?: string;
  };
  confidence: number;
  warnings: string[];
}
