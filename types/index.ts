export type PartyType = 'Landlord' | 'Tenant' | 'Witness';

export interface Party {
  id?: string;
  type: PartyType;
  fullName: string;
  aadhaar: string;
  pan?: string;
  mobile?: string;
  age?: string;
  gender?: string;
  dob?: string;
  nativeAddress: string;
  confidenceScore?: number;
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
