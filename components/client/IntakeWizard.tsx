'use client';

import React, { useState, useMemo, useRef } from 'react';
import { translations, Language } from '@/lib/dictionary';
import { calculateTotalAgreementFee } from '@/lib/calculator';
import { compressImageFile } from '@/lib/imageCompressor';
import { splitNameMaharashtrian, deriveSalutation, computeAge } from '@/lib/documentExtractor';
import {
  DocType,
  ExtractionResult,
  NameSplit,
  AddressSplit,
  Party,
  PropertyDetails,
  Financials,
} from '@/types';
import {
  FileText,
  Upload,
  CheckCircle2,
  Plus,
  Trash2,
  Copy,
  Languages,
  Building2,
  AlertCircle,
  Clock,
  Sparkles,
  Check,
  IndianRupee,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChevronDown,
  X,
} from 'lucide-react';

interface PersonFormState {
  fullName: string;
  name_en: NameSplit;
  salutation: string;
  gender: string;
  dob: string;
  age: string;
  aadhaar: string;
  pan: string;
  mobile: string;
  email: string;
  nativeAddress: string;
  address_en: AddressSplit;
  aiFields: Record<string, boolean>;
  unverifiedFields: Record<string, boolean>;
}

interface TenantFormState extends PersonFormState {
  aadhaarFront?: string;
  aadhaarBack?: string;
  panFile?: string;
}

const emptyPersonState = (defaultSalutation: string = 'Mr', defaultGender: string = 'Male'): PersonFormState => ({
  fullName: '',
  name_en: { surname: '', first: '', middle: '' },
  salutation: defaultSalutation,
  gender: defaultGender,
  dob: '',
  age: '',
  aadhaar: '',
  pan: '',
  mobile: '',
  email: '',
  nativeAddress: '',
  address_en: {
    building: '',
    flat_no: '',
    floor_no: '',
    road: '',
    location: '',
    village_city: '',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '',
  },
  aiFields: {},
  unverifiedFields: {},
});

export default function IntakeWizard() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [aiToast, setAiToast] = useState<string | null>(null);

  // Per-card AI extraction spinners
  const [extractingCards, setExtractingCards] = useState<Record<string, boolean>>({});

  // Client-side cache to prevent duplicate Gemini API calls
  const extractionCache = useRef<Record<string, ExtractionResult>>({});

  // STEP 1 Form State
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [partyType, setPartyType] = useState<'Landlord' | 'Tenant'>('Tenant');
  const [propertyType, setPropertyType] = useState<'Flat' | 'Room' | 'Shop'>('Flat');
  const [rent, setRent] = useState<string>('');
  const [deposit, setDeposit] = useState<string>('');
  const [durationMonths, setDurationMonths] = useState<string>('11');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Property Details
  const [buildingName, setBuildingName] = useState<string>('');
  const [flatNo, setFlatNo] = useState<string>('');
  const [floorNo, setFloorNo] = useState<string>('');
  const [road, setRoad] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [village, setVillage] = useState<string>('');
  const [surveyNo, setSurveyNo] = useState<string>('');
  const [areaSqFt, setAreaSqFt] = useState<string>('250');
  const [furniture, setFurniture] = useState<string>('');

  // Collapsible IGR Property Details
  const [district, setDistrict] = useState<string>('Pune');
  const [taluka, setTaluka] = useState<string>('Haveli');
  const [villageIgr, setVillageIgr] = useState<string>('');
  const [areaType, setAreaType] = useState<string>('Urban');
  const [localLimitType, setLocalLimitType] = useState<string>('Corporation');
  const [localLimitName, setLocalLimitName] = useState<string>('Pune');
  const [attribute1Type, setAttribute1Type] = useState<string>('Survey Number');
  const [unitType, setUnitType] = useState<string>('Apartment/Flat');
  const [unitAreaUom, setUnitAreaUom] = useState<string>('Square Feet');
  const [propertyUse, setPropertyUse] = useState<string>('Residential');
  const [galleryArea, setGalleryArea] = useState<string>('0');
  const [parkingArea, setParkingArea] = useState<string>('0');
  const [policeStation, setPoliceStation] = useState<string>('');

  // STEP 2 Parties State
  const [landlord, setLandlord] = useState<PersonFormState>(emptyPersonState('Mr', 'Male'));
  const [tenants, setTenants] = useState<TenantFormState[]>([
    { ...emptyPersonState('Mr', 'Male'), aadhaarFront: '', aadhaarBack: '', panFile: '' },
  ]);
  const [witness1, setWitness1] = useState<PersonFormState>(emptyPersonState('Mr', 'Male'));
  const [witness2, setWitness2] = useState<PersonFormState>(emptyPersonState('Mr', 'Male'));

  // Uploaded File Base64 Paths for Landlord & Witnesses & Electricity
  const [landlordAadhaarFront, setLandlordAadhaarFront] = useState<string>('');
  const [landlordAadhaarBack, setLandlordAadhaarBack] = useState<string>('');
  const [landlordPanFile, setLandlordPanFile] = useState<string>('');

  const [witness1AadhaarFront, setWitness1AadhaarFront] = useState<string>('');
  const [witness1AadhaarBack, setWitness1AadhaarBack] = useState<string>('');
  const [witness2AadhaarFront, setWitness2AadhaarFront] = useState<string>('');
  const [witness2AadhaarBack, setWitness2AadhaarBack] = useState<string>('');

  const [electricityBill, setElectricityBill] = useState<string>('');

  // Generated Token Result
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [syncedToSheets, setSyncedToSheets] = useState<boolean>(true);
  const [retryingSync, setRetryingSync] = useState<boolean>(false);

  // Live Calculated Total Fee
  const feeCalculation = useMemo(() => {
    return calculateTotalAgreementFee(Number(rent), Number(deposit), Number(durationMonths));
  }, [rent, deposit, durationMonths]);

  // Handle Mobile Number (strictly max 10 digits)
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(cleanDigits);
  };

  // Add Tenant
  const handleAddTenant = () => {
    setTenants((prev) => [
      ...prev,
      { ...emptyPersonState('Mr', 'Male'), aadhaarFront: '', aadhaarBack: '', panFile: '' },
    ]);
  };

  // Remove Tenant (must keep at least 1)
  const handleRemoveTenant = (index: number) => {
    if (tenants.length > 1) {
      setTenants((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Helper to drop AI/Verify tag when user modifies a field
  const clearFieldTag = (personSetter: React.Dispatch<React.SetStateAction<any>>, fieldKey: string) => {
    personSetter((prev: any) => ({
      ...prev,
      aiFields: { ...prev.aiFields, [fieldKey]: false },
      unverifiedFields: { ...prev.unverifiedFields, [fieldKey]: false },
    }));
  };

  // Merge Extracted AI Data into a target person
  const mergeExtractedData = (
    target: 'landlord' | 'witness1' | 'witness2' | number | 'property',
    docType: DocType,
    result: ExtractionResult
  ) => {
    const f = result.fields || {};
    const isLowConfidence = (result.confidence ?? 1.0) < 0.85;

    const updatePerson = (prev: PersonFormState): PersonFormState => {
      const next = { ...prev };
      const newAi = { ...next.aiFields };
      const newUnverified = { ...next.unverifiedFields };

      if (docType === 'aadhaar_front') {
        if (f.fullName) {
          next.fullName = f.fullName;
          next.name_en = f.name_en || splitNameMaharashtrian(f.fullName);
          newAi.fullName = true;
          if (isLowConfidence) newUnverified.fullName = true;
        }
        if (f.aadhaarNumber) {
          next.aadhaar = f.aadhaarNumber;
          newAi.aadhaar = true;
          if (isLowConfidence || !/^\d{12}$/.test(f.aadhaarNumber.replace(/\s+/g, ''))) {
            newUnverified.aadhaar = true;
          }
        }
        if (f.dob) {
          next.dob = f.dob;
          newAi.dob = true;
        }
        if (f.age) {
          next.age = f.age;
          newAi.age = true;
        }
        if (f.gender) {
          next.gender = f.gender;
          next.salutation = f.salutation || deriveSalutation(f.gender);
          newAi.gender = true;
          newAi.salutation = true;
        }
        if (f.nativeAddress) {
          next.nativeAddress = f.nativeAddress;
          newAi.nativeAddress = true;
          if (isLowConfidence) newUnverified.nativeAddress = true;
        }
        if (f.address_en) {
          next.address_en = { ...next.address_en, ...f.address_en };
          newAi.address_en = true;
          if (isLowConfidence || (f.address_en.pincode && !/^\d{6}$/.test(f.address_en.pincode))) {
            newUnverified.pincode = true;
          }
        }
        if (f.panNumber) {
          next.pan = f.panNumber;
          newAi.pan = true;
          if (isLowConfidence || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.panNumber)) {
            newUnverified.pan = true;
          }
        }
      } else if (docType === 'aadhaar_back') {
        if (f.nativeAddress) {
          next.nativeAddress = f.nativeAddress;
          newAi.nativeAddress = true;
          if (isLowConfidence) newUnverified.nativeAddress = true;
        }
        if (f.address_en) {
          next.address_en = { ...next.address_en, ...f.address_en };
          newAi.address_en = true;
          if (isLowConfidence || (f.address_en.pincode && !/^\d{6}$/.test(f.address_en.pincode))) {
            newUnverified.pincode = true;
          }
        }
        if (!next.aadhaar && f.aadhaarNumber) {
          next.aadhaar = f.aadhaarNumber;
          newAi.aadhaar = true;
        }
      } else if (docType === 'pan') {
        if (f.panNumber) {
          next.pan = f.panNumber;
          newAi.pan = true;
          if (isLowConfidence || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.panNumber)) {
            newUnverified.pan = true;
          }
        }
        if (!next.fullName && f.fullName) {
          next.fullName = f.fullName;
          next.name_en = f.name_en || splitNameMaharashtrian(f.fullName);
          newAi.fullName = true;
        }
        if (!next.dob && f.dob) {
          next.dob = f.dob;
          next.age = f.age || computeAge(f.dob);
          newAi.dob = true;
          if (next.age) newAi.age = true;
        }
      }

      next.aiFields = newAi;
      next.unverifiedFields = newUnverified;
      return next;
    };

    if (target === 'landlord') {
      setLandlord((prev) => updatePerson(prev));
    } else if (target === 'witness1') {
      setWitness1((prev) => updatePerson(prev));
    } else if (target === 'witness2') {
      setWitness2((prev) => updatePerson(prev));
    } else if (typeof target === 'number') {
      setTenants((prev) => {
        const copy = [...prev];
        if (copy[target]) {
          const updated = updatePerson(copy[target]);
          copy[target] = { ...copy[target], ...updated };
        }
        return copy;
      });
    } else if (target === 'property') {
      if (f.buildingName) setBuildingName(f.buildingName);
      if (f.flatNo) setFlatNo(f.flatNo);
      if (f.floorNo) setFloorNo(f.floorNo);
      if (f.surveyNo) setSurveyNo(f.surveyNo);
      if (f.village) {
        setVillage(f.village);
        setVillageIgr(f.village);
      } else if (f.nativeAddress) {
        const parts = f.nativeAddress.split(',').map((p) => p.trim());
        const candidateVillage = parts.length > 1 ? parts[parts.length - 2] : parts[0];
        if (candidateVillage) {
          setVillage(candidateVillage);
          setVillageIgr(candidateVillage);
        }
      }
    }
  };

  // Upload file with client-side compression + Gemini extraction + cache
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    cardKey: string,
    docType: DocType,
    target: 'landlord' | 'witness1' | 'witness2' | number | 'property',
    fileCallback: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractingCards((prev) => ({ ...prev, [cardKey]: true }));

    try {
      // 1. Compress image client-side (max ~1600px, JPEG 0.8)
      const { base64, mimeType } = await compressImageFile(file);
      fileCallback(base64);

      // 2. Check cache
      const cacheKey = `${file.name}_${file.size}_${file.lastModified}_${docType}`;
      let extractionResult: ExtractionResult;

      if (extractionCache.current[cacheKey]) {
        extractionResult = extractionCache.current[cacheKey];
      } else {
        // 3. Call server route POST /api/extract
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64, mimeType, docType }),
        });
        const data = await res.json();
        extractionResult = data;
        if (data?.fields && Object.keys(data.fields).length > 0) {
          extractionCache.current[cacheKey] = data;
        }
      }

      const extractedFieldCount = extractionResult?.fields ? Object.keys(extractionResult.fields).length : 0;

      if (extractedFieldCount > 0) {
        mergeExtractedData(target, docType, extractionResult);

        // Auto-detect combined files (e.g. Aadhaar Front + Back or Front + Back + PAN in slot 1)
        if (docType === 'aadhaar_front') {
          const hasBack = Boolean(
            extractionResult.fields.hasBackSide ||
            (extractionResult.fields.nativeAddress && extractionResult.fields.nativeAddress.length > 8) ||
            extractionResult.fields.address_en?.village_city
          );
          const hasPan = Boolean(
            extractionResult.fields.hasPanCard ||
            (extractionResult.fields.panNumber && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(extractionResult.fields.panNumber))
          );

          if (hasBack) {
            if (target === 'landlord') {
              setLandlordAadhaarBack(base64);
            } else if (target === 'witness1') {
              setWitness1AadhaarBack(base64);
            } else if (target === 'witness2') {
              setWitness2AadhaarBack(base64);
            } else if (typeof target === 'number') {
              setTenants((prev) => {
                const c = [...prev];
                if (c[target]) c[target] = { ...c[target], aadhaarBack: base64 };
                return c;
              });
            }
          }

          if (hasPan) {
            if (target === 'landlord') {
              setLandlordPanFile(base64);
            } else if (typeof target === 'number') {
              setTenants((prev) => {
                const c = [...prev];
                if (c[target]) c[target] = { ...c[target], panFile: base64 };
                return c;
              });
            }
          }

          if (hasBack && hasPan) {
            setAiToast('🎉 All-in-One Document! Aadhaar Front, Back & PAN auto-detected & filled!');
            setTimeout(() => setAiToast(null), 5500);
            return;
          } else if (hasBack) {
            setAiToast('✨ Front & Back Detected! Aadhaar Front & Back auto-detected & filled.');
            setTimeout(() => setAiToast(null), 5500);
            return;
          } else if (hasPan) {
            setAiToast('✨ Aadhaar Front & PAN auto-detected in single document!');
            setTimeout(() => setAiToast(null), 5500);
            return;
          }
        }

        const info =
          extractionResult.fields.fullName ||
          extractionResult.fields.consumerName ||
          extractionResult.fields.aadhaarNumber ||
          extractionResult.fields.panNumber ||
          'Document';
        setAiToast(`✨ AI Extracted: ${info}`);
        setTimeout(() => setAiToast(null), 4500);
      } else {
        const warningMsg =
          extractionResult?.warnings?.[0] ||
          'AI could not read fields from this document. Please verify image clarity or enter details manually.';
        setAiToast(`⚠️ ${warningMsg}`);
        setTimeout(() => setAiToast(null), 5500);
      }
    } catch (err: any) {
      console.warn('Document extraction notice:', err);
      setAiToast('⚠️ Extraction notice: Please verify or enter fields manually.');
      setTimeout(() => setAiToast(null), 4500);
    } finally {
      setExtractingCards((prev) => ({ ...prev, [cardKey]: false }));
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (
      mobileNumber.length !== 10 ||
      !rent.trim() ||
      !deposit.trim() ||
      !durationMonths.trim() ||
      !startDate.trim()
    ) {
      setErrorMessage(t.step1ValidationError);
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleNextToStep2 = () => {
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Step 2 Document Check
  const getMissingDocuments = (): string[] => {
    const missing: string[] = [];

    if (!landlordAadhaarFront) missing.push('Landlord Aadhaar (Front)');
    if (!landlordAadhaarBack) missing.push('Landlord Aadhaar (Back)');
    if (!landlordPanFile) missing.push('Landlord PAN Card');

    tenants.forEach((tenant, idx) => {
      if (!tenant.aadhaarFront) missing.push(`Tenant #${idx + 1} Aadhaar (Front)`);
      if (!tenant.aadhaarBack) missing.push(`Tenant #${idx + 1} Aadhaar (Back)`);
      if (!tenant.panFile) missing.push(`Tenant #${idx + 1} PAN Card`);
    });

    if (!witness1AadhaarFront) missing.push('Witness 1 Aadhaar (Front)');
    if (!witness1AadhaarBack) missing.push('Witness 1 Aadhaar (Back)');
    if (!witness2AadhaarFront) missing.push('Witness 2 Aadhaar (Front)');
    if (!witness2AadhaarBack) missing.push('Witness 2 Aadhaar (Back)');
    if (!electricityBill) missing.push('Electricity Bill');

    return missing;
  };

  // Submit Intake Form
  const handleSubmit = async () => {
    // Validate party rules: exactly 1 landlord, >=1 tenant, exactly 2 witnesses
    if (tenants.length < 1) {
      setErrorMessage('At least one tenant is required.');
      return;
    }

    const missing = getMissingDocuments();
    if (missing.length > 0) {
      setErrorMessage(`Please upload the following required document(s): ${missing.join(', ')}`);
      return;
    }

    // Validate party required fields
    if (!landlord.fullName.trim() || !landlord.aadhaar.trim()) {
      setErrorMessage('Landlord name and Aadhaar number are required.');
      return;
    }

    for (let i = 0; i < tenants.length; i++) {
      if (!tenants[i].fullName.trim() || !tenants[i].aadhaar.trim()) {
        setErrorMessage(`Tenant #${i + 1} name and Aadhaar number are required.`);
        return;
      }
    }

    if (!witness1.fullName.trim() || !witness1.aadhaar.trim()) {
      setErrorMessage('Witness 1 name and Aadhaar number are required.');
      return;
    }
    if (!witness2.fullName.trim() || !witness2.aadhaar.trim()) {
      setErrorMessage('Witness 2 name and Aadhaar number are required.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const landlordParty: Party = {
        type: 'Landlord',
        fullName: landlord.fullName.trim(),
        name_en: landlord.name_en || splitNameMaharashtrian(landlord.fullName),
        salutation: landlord.salutation || 'Mr',
        gender: landlord.gender || 'Male',
        age: landlord.age,
        dob: landlord.dob,
        aadhaar: landlord.aadhaar.trim(),
        pan: landlord.pan.trim(),
        mobile: landlord.mobile.trim() || mobileNumber,
        email: landlord.email.trim(),
        nativeAddress: landlord.nativeAddress.trim(),
        address_en: landlord.address_en,
      };

      const tenantParties: Party[] = tenants.map((t, idx) => ({
        type: 'Tenant',
        fullName: t.fullName.trim() || `Tenant #${idx + 1}`,
        name_en: t.name_en || splitNameMaharashtrian(t.fullName),
        salutation: t.salutation || 'Mr',
        gender: t.gender || 'Male',
        age: t.age,
        dob: t.dob,
        aadhaar: t.aadhaar.trim(),
        pan: t.pan.trim(),
        mobile: t.mobile.trim(),
        email: t.email.trim(),
        nativeAddress: t.nativeAddress.trim(),
        address_en: t.address_en,
      }));

      const witnessParties: Party[] = [
        {
          type: 'Witness',
          fullName: witness1.fullName.trim() || 'Witness 1',
          name_en: witness1.name_en || splitNameMaharashtrian(witness1.fullName),
          salutation: witness1.salutation || 'Mr',
          gender: witness1.gender || 'Male',
          age: witness1.age,
          dob: witness1.dob,
          aadhaar: witness1.aadhaar.trim(),
          pan: witness1.pan.trim(),
          mobile: witness1.mobile.trim(),
          nativeAddress: witness1.nativeAddress.trim(),
          address_en: witness1.address_en,
        },
        {
          type: 'Witness',
          fullName: witness2.fullName.trim() || 'Witness 2',
          name_en: witness2.name_en || splitNameMaharashtrian(witness2.fullName),
          salutation: witness2.salutation || 'Mr',
          gender: witness2.gender || 'Male',
          age: witness2.age,
          dob: witness2.dob,
          aadhaar: witness2.aadhaar.trim(),
          pan: witness2.pan.trim(),
          mobile: witness2.mobile.trim(),
          nativeAddress: witness2.nativeAddress.trim(),
          address_en: witness2.address_en,
        },
      ];

      const propertyData: PropertyDetails = {
        propertyType,
        buildingName: buildingName.trim(),
        flatNo: flatNo.trim(),
        floorNo: floorNo.trim(),
        surveyNo: surveyNo.trim(),
        areaSqFt: areaSqFt.trim() || '250',
        road: road.trim(),
        landmark: landmark.trim(),
        village: village.trim() || 'Pune',
        city: 'Pune',
        pincode: landlord.address_en?.pincode || '412207',
        furnitureDetails: furniture.trim(),
        district: district || 'Pune',
        taluka: taluka || 'Haveli',
        village_igr: villageIgr || village || 'Pune',
        area_type: areaType || 'Urban',
        local_limit_type: localLimitType || 'Corporation',
        local_limit_name: localLimitName || 'Pune',
        attribute1_type: attribute1Type || 'Survey Number',
        attribute1_number: surveyNo.trim(),
        unit_type: unitType || 'Apartment/Flat',
        unit_area: areaSqFt.trim() || '250',
        unit_area_uom: unitAreaUom || 'Square Feet',
        building_en: buildingName.trim(),
        flat_no_en: flatNo.trim(),
        floor_no_en: floorNo.trim(),
        road_en: road.trim(),
        location_en: landmark.trim(),
        use: propertyUse || 'Residential',
        gallery_area: galleryArea || '0',
        gallery_area_uom: 'Square Meter',
        parking_area: parkingArea || '0',
        parking_area_uom: 'Square Meter',
        police_station: policeStation.trim(),
      };

      const financialsData: Financials = {
        rent: Number(rent),
        deposit: Number(deposit),
        tenureMonths: Number(durationMonths),
        startDate,
        fee: feeCalculation.totalAmount,
      };

      const filesPayload = {
        landlordAadhaarFront,
        landlordAadhaarBack,
        landlordPan: landlordPanFile,
        electricityBill,
        tenantAadhaarFront: tenants.map((t) => t.aadhaarFront || ''),
        tenantAadhaarBack: tenants.map((t) => t.aadhaarBack || ''),
        tenantPan: tenants.map((t) => t.panFile || ''),
        witness1AadhaarFront,
        witness1AadhaarBack,
        witness2AadhaarFront,
        witness2AadhaarBack,
      };

      const payload = {
        mobileNumber,
        landlord: landlordParty,
        tenants: tenantParties,
        witnesses: witnessParties,
        propertyDetails: propertyData,
        financials: financialsData,
        files: filesPayload,
      };

      const res = await fetch('/api/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (resData.success) {
        setGeneratedToken(resData.tokenNumber);
        setSyncedToSheets(resData.syncedToSheets ?? false);
        setStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMessage(resData.error || 'Submission failed. Please check details and try again.');
      }
    } catch (err: any) {
      setErrorMessage('Network error occurred during submission. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async () => {
    if (!generatedToken) return;
    setRetryingSync(true);
    try {
      const res = await fetch(`/api/cases/${generatedToken}/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncedToSheets(true);
        setAiToast('✅ Successfully synced to Google Sheet!');
        setTimeout(() => setAiToast(null), 4000);
      } else {
        alert(data.error || 'Sync failed. Please check Google Sheet Webhook URL.');
      }
    } catch (err) {
      alert('Network error while retrying sync.');
    } finally {
      setRetryingSync(false);
    }
  };

  const whatsappConfirmationText = `Hello! I have submitted my Rent Agreement details.\nToken Number: *${generatedToken}*\nMobile: ${mobileNumber}\nProperty: ${flatNo || ''} ${buildingName || ''}, Pune.\nPlease update me regarding further contact.`;

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(whatsappConfirmationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Helper badge renderer
  const renderBadges = (person: PersonFormState, fieldKey: string) => {
    const isAi = person.aiFields?.[fieldKey];
    const isVerify = person.unverifiedFields?.[fieldKey];
    if (!isAi && !isVerify) return null;
    return (
      <span className="inline-flex items-center gap-1 ml-1.5 align-middle">
        {isAi && (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            AI
          </span>
        )}
        {isVerify && (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider">
            Verify
          </span>
        )}
      </span>
    );
  };

  // Collapsible IGR Fields component per person
  const renderIgrPersonFields = (
    person: PersonFormState,
    setPerson: React.Dispatch<React.SetStateAction<any>>,
    label: string,
    showPan: boolean = true
  ) => {
    return (
      <details className="mt-2 text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
        <summary className="cursor-pointer font-bold text-slate-700 select-none flex items-center justify-between text-[11px] uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
            <ChevronDown className="w-3.5 h-3.5 text-emerald-600 inline" />
            {label} — IGR Breakdown Fields
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold lowercase">click to expand/edit</span>
        </summary>

        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          {/* Name Split */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">First Name</label>
              <input
                type="text"
                value={person.name_en?.first || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    name_en: { ...p.name_en, first: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'fullName');
                }}
                placeholder="First Name"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Middle Name</label>
              <input
                type="text"
                value={person.name_en?.middle || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    name_en: { ...p.name_en, middle: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'fullName');
                }}
                placeholder="Middle Name"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Surname</label>
              <input
                type="text"
                value={person.name_en?.surname || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    name_en: { ...p.name_en, surname: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'fullName');
                }}
                placeholder="Surname"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
          </div>

          {/* Salutation, Gender, Age */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Salutation</label>
              <select
                value={person.salutation || 'Mr'}
                onChange={(e) => {
                  setPerson((p: any) => ({ ...p, salutation: e.target.value }));
                  clearFieldTag(setPerson, 'salutation');
                }}
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              >
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Miss">Miss</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Gender</label>
              <select
                value={person.gender || 'Male'}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    gender: e.target.value,
                    salutation: deriveSalutation(e.target.value),
                  }));
                  clearFieldTag(setPerson, 'gender');
                }}
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Age</label>
              <input
                type="text"
                value={person.age || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({ ...p, age: e.target.value }));
                  clearFieldTag(setPerson, 'age');
                }}
                placeholder="e.g. 35"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Mobile Number</label>
              <input
                type="tel"
                maxLength={10}
                value={person.mobile || ''}
                onChange={(e) => {
                  const num = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPerson((p: any) => ({ ...p, mobile: num }));
                  clearFieldTag(setPerson, 'mobile');
                }}
                placeholder="10-digit mobile"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Email (Optional)</label>
              <input
                type="email"
                value={person.email || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({ ...p, email: e.target.value }));
                  clearFieldTag(setPerson, 'email');
                }}
                placeholder="email@example.com"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
          </div>

          {/* Address Parts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Road / Street</label>
              <input
                type="text"
                value={person.address_en?.road || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    address_en: { ...p.address_en, road: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'address_en');
                }}
                placeholder="Road name"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Location / Area</label>
              <input
                type="text"
                value={person.address_en?.location || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    address_en: { ...p.address_en, location: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'address_en');
                }}
                placeholder="Nearby Landmark / Area"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Village / City</label>
              <input
                type="text"
                value={person.address_en?.village_city || ''}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    address_en: { ...p.address_en, village_city: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'address_en');
                }}
                placeholder="Village / City"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">District</label>
              <input
                type="text"
                value={person.address_en?.district || 'Pune'}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    address_en: { ...p.address_en, district: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'address_en');
                }}
                placeholder="District"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">State</label>
              <input
                type="text"
                value={person.address_en?.state || 'Maharashtra'}
                onChange={(e) => {
                  setPerson((p: any) => ({
                    ...p,
                    address_en: { ...p.address_en, state: e.target.value },
                  }));
                  clearFieldTag(setPerson, 'address_en');
                }}
                placeholder="State"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Pincode</label>
              <input
                type="text"
                maxLength={6}
                value={person.address_en?.pincode || ''}
                onChange={(e) => {
                  const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPerson((p: any) => ({
                    ...p,
                    address_en: { ...p.address_en, pincode: pin },
                  }));
                  clearFieldTag(setPerson, 'pincode');
                }}
                placeholder="6-digit pincode"
                className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
              />
            </div>
          </div>
        </div>
      </details>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Toast Notification */}
      {aiToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg border border-emerald-600 animate-bounce flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-300 animate-spin" />
          <span>{aiToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">{t.appTitle}</h1>
            <p className="text-xs text-slate-500">{t.subTitle}</p>
          </div>
        </div>

        {/* Language Toggle */}
        <button
          onClick={() => setLang(lang === 'en' ? 'mr' : 'en')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
        >
          <Languages className="w-4 h-4" />
          {lang === 'en' ? 'मराठी' : 'English'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center text-xs text-slate-600 font-semibold mb-2">
          <span>{t.intakeProgress}</span>
          <span className="text-emerald-600 font-bold">
            {step === 1 ? '20%' : step === 2 ? '65%' : '100%'}
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full transition-all duration-500 ease-out"
            style={{ width: step === 1 ? '20%' : step === 2 ? '65%' : '100%' }}
          />
        </div>
      </div>

      {/* Floating Centered Error Pop-up Modal (Always visible wherever user has scrolled) */}
      {errorMessage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setErrorMessage('')}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Submission Notice</h3>
                <p className="text-xs text-slate-500 mt-0.5">Please check and resolve the following issue:</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 text-red-800 text-xs font-semibold leading-relaxed">
              {errorMessage}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition shadow-md"
              >
                Dismiss & Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message Inline Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2 shadow-sm leading-relaxed">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Basic Agreement & Property Details */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-emerald-600" />
            {t.step1Title}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.mobileNumber} <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                value={mobileNumber}
                onChange={handleMobileChange}
                placeholder={`Enter ${t.mobileNumber}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {mobileNumber.length}/10 digits entered
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.landlordTenant}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPartyType('Tenant')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
                    partyType === 'Tenant'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.tenant}
                </button>
                <button
                  type="button"
                  onClick={() => setPartyType('Landlord')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
                    partyType === 'Landlord'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.landlord}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.propertyType}</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as any)}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              >
                <option value="Flat">{t.flat}</option>
                <option value="Room">{t.room}</option>
                <option value="Shop">{t.shop}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rentAmount} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                placeholder={`Enter ${t.rentAmount}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.depositAmount} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder={`Enter ${t.depositAmount}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.durationMonths} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                placeholder={`Enter ${t.durationMonths}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.startDate} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            {/* Upload Property Document (Electricity Bill / Index II) for Auto-Fill */}
            <div className="col-span-1 md:col-span-2 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  {t.electricityBill} (or Property Tax / Index II)
                  <span className="text-red-500">*</span>
                </label>
                {extractingCards['electricity_bill'] && (
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Extracting Property Details...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Upload your electricity bill or property document to automatically extract and fill Building Name, Flat No, Floor, Village, and Survey details below.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    handleFileUpload(
                      e,
                      'electricity_bill',
                      'electricity_bill',
                      'property',
                      setElectricityBill
                    )
                  }
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 file:cursor-pointer file:transition"
                />
                {electricityBill && (
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 whitespace-nowrap bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300">
                    <Check className="w-4 h-4 text-emerald-600" /> Uploaded & Populated
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.buildingName}</label>
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder={`Enter ${t.buildingName}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.flatNo}</label>
              <input
                type="text"
                value={flatNo}
                onChange={(e) => setFlatNo(e.target.value)}
                placeholder={`Enter ${t.flatNo}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.floorNo}</label>
              <input
                type="text"
                value={floorNo}
                onChange={(e) => setFloorNo(e.target.value)}
                placeholder={`Enter ${t.floorNo}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.village}</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder={`Enter ${t.village}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.surveyNo}</label>
              <input
                type="text"
                value={surveyNo}
                onChange={(e) => setSurveyNo(e.target.value)}
                placeholder={`Enter ${t.surveyNo}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Property Area (Sq.Ft)
              </label>
              <input
                type="text"
                value={areaSqFt}
                onChange={(e) => setAreaSqFt(e.target.value)}
                placeholder="e.g. 600"
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.furniture}</label>
              <input
                type="text"
                value={furniture}
                onChange={(e) => setFurniture(e.target.value)}
                placeholder={`Enter ${t.furniture}`}
                className="w-full glass-input px-3.5 py-2.5 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Collapsible IGR Property Fields Section */}
          <details className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <summary className="cursor-pointer font-bold text-emerald-800 select-none flex items-center justify-between text-xs uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <ChevronDown className="w-4 h-4 text-emerald-600 inline" />
                IGR Property Fields (Pune, Haveli & Registry Defaults)
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold lowercase">click to inspect/edit</span>
            </summary>
            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Taluka</label>
                <input
                  type="text"
                  value={taluka}
                  onChange={(e) => setTaluka(e.target.value)}
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Village (IGR Portal)</label>
                <input
                  type="text"
                  value={villageIgr || village}
                  onChange={(e) => setVillageIgr(e.target.value)}
                  placeholder="e.g. Vadgaon Sheri / Wagholi"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Area Type</label>
                <select
                  value={areaType}
                  onChange={(e) => setAreaType(e.target.value)}
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                >
                  <option value="Urban">Urban</option>
                  <option value="Rural">Rural</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Local Limit Type</label>
                <input
                  type="text"
                  value={localLimitType}
                  onChange={(e) => setLocalLimitType(e.target.value)}
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Local Limit Name</label>
                <input
                  type="text"
                  value={localLimitName}
                  onChange={(e) => setLocalLimitName(e.target.value)}
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit Type</label>
                <input
                  type="text"
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Use</label>
                <select
                  value={propertyUse}
                  onChange={(e) => setPropertyUse(e.target.value)}
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                >
                  <option value="Residential">Residential</option>
                  <option value="Non-Residential">Non-Residential</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Police Station</label>
                <input
                  type="text"
                  value={policeStation}
                  onChange={(e) => setPoliceStation(e.target.value)}
                  placeholder="e.g. Wagholi Police Station"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
            </div>
          </details>

          {/* Fee Display */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-950 block">
                  {t.totalCalculatedFee}
                </span>
                <span className="text-[11px] text-emerald-700">Calculated automatically for lease terms</span>
              </div>
            </div>
            <div className="sm:text-right">
              <span className="text-2xl font-black text-emerald-700 whitespace-nowrap inline-flex items-center gap-0.5">
                ₹ {feeCalculation.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextToStep2}
            className="w-full min-h-[48px] py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl glow-button transition flex items-center justify-center gap-2 text-sm shadow-md"
          >
            <span>{t.step2Title}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      )}

      {/* STEP 2: Document Upload & AI Extracted Verification Fields */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Upload className="w-4 h-4 text-emerald-600" />
            {t.step2Title}
          </h2>

          <p className="text-xs text-slate-600 bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 leading-relaxed">
            <strong>AI Auto-Extraction:</strong> When you select a document image or PDF, Gemini AI compresses and parses full names, 12-digit Aadhaar, PAN, age, gender, and addresses. Aadhaar front and back merge automatically into one record. All fields remain editable.
          </p>

          {/* 1. Landlord Documents Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                {t.landlordDocs}
                {(extractingCards['landlord_aadhaar_front'] ||
                  extractingCards['landlord_aadhaar_back'] ||
                  extractingCards['landlord_pan']) && (
                  <span className="text-[11px] text-emerald-600 normal-case flex items-center gap-1 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Extracting...
                  </span>
                )}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t.aadhaarFront} <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    handleFileUpload(
                      e,
                      'landlord_aadhaar_front',
                      'aadhaar_front',
                      'landlord',
                      setLandlordAadhaarFront
                    )
                  }
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                />
                {landlordAadhaarFront && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    <Check className="w-3 h-3" /> Uploaded
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t.aadhaarBack} <span className="text-red-500">*</span>
                </label>
                {landlordAadhaarBack && landlordAadhaarBack === landlordAadhaarFront ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                    <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Auto-detected from 1st file
                    </span>
                    <button
                      type="button"
                      onClick={() => setLandlordAadhaarBack('')}
                      className="text-[10px] text-emerald-700 underline font-semibold mt-1 block"
                    >
                      Upload separate back side
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        handleFileUpload(
                          e,
                          'landlord_aadhaar_back',
                          'aadhaar_back',
                          'landlord',
                          setLandlordAadhaarBack
                        )
                      }
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                    />
                    {landlordAadhaarBack && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                        <Check className="w-3 h-3" /> Uploaded
                      </span>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t.panCard} <span className="text-red-500">*</span>
                </label>
                {landlordPanFile && landlordPanFile === landlordAadhaarFront ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                    <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Auto-detected from 1st file
                    </span>
                    <button
                      type="button"
                      onClick={() => setLandlordPanFile('')}
                      className="text-[10px] text-emerald-700 underline font-semibold mt-1 block"
                    >
                      Upload separate PAN card
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        handleFileUpload(
                          e,
                          'landlord_pan',
                          'pan',
                          'landlord',
                          setLandlordPanFile
                        )
                      }
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                    />
                    {landlordPanFile && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                        <Check className="w-3 h-3" /> Uploaded
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Extracted/Editable Landlord Text Fields */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Landlord Full Name
                  {renderBadges(landlord, 'fullName')}
                </label>
                <input
                  type="text"
                  value={landlord.fullName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLandlord((prev) => ({
                      ...prev,
                      fullName: val,
                      name_en: splitNameMaharashtrian(val),
                    }));
                    clearFieldTag(setLandlord, 'fullName');
                  }}
                  placeholder="Enter / AI Extracted Full Name"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Aadhaar Number
                  {renderBadges(landlord, 'aadhaar')}
                </label>
                <input
                  type="text"
                  value={landlord.aadhaar}
                  onChange={(e) => {
                    setLandlord((prev) => ({ ...prev, aadhaar: e.target.value }));
                    clearFieldTag(setLandlord, 'aadhaar');
                  }}
                  placeholder="12-digit Aadhaar Number"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  PAN Number
                  {renderBadges(landlord, 'pan')}
                </label>
                <input
                  type="text"
                  value={landlord.pan}
                  onChange={(e) => {
                    setLandlord((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }));
                    clearFieldTag(setLandlord, 'pan');
                  }}
                  placeholder="10-character PAN Number"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Native Address
                  {renderBadges(landlord, 'nativeAddress')}
                </label>
                <input
                  type="text"
                  value={landlord.nativeAddress}
                  onChange={(e) => {
                    setLandlord((prev) => ({ ...prev, nativeAddress: e.target.value }));
                    clearFieldTag(setLandlord, 'nativeAddress');
                  }}
                  placeholder="Permanent / Native Address"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
            </div>

            {/* Collapsible IGR Fields for Landlord */}
            {renderIgrPersonFields(landlord, setLandlord, 'Landlord')}
          </div>

          {/* 2. Multi-Tenant Documents & AI Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                {t.tenantDocs.replace('{no}', `(Total: ${tenants.length})`)}
              </h3>
              <button
                type="button"
                onClick={handleAddTenant}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addTenant}
              </button>
            </div>

            {tenants.map((tenant, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                    Tenant #{idx + 1}
                    {(extractingCards[`tenant_${idx}_aadhaar_front`] ||
                      extractingCards[`tenant_${idx}_aadhaar_back`] ||
                      extractingCards[`tenant_${idx}_pan`]) && (
                      <span className="text-[11px] text-emerald-600 font-normal flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> AI Extracting...
                      </span>
                    )}
                  </span>
                  {tenants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTenant(idx)}
                      className="text-red-600 hover:text-red-700 text-xs flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.removeTenant}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {t.aadhaarFront} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        handleFileUpload(
                          e,
                          `tenant_${idx}_aadhaar_front`,
                          'aadhaar_front',
                          idx,
                          (b) =>
                            setTenants((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], aadhaarFront: b };
                              return copy;
                            })
                        )
                      }
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                    />
                    {tenant.aadhaarFront && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                        <Check className="w-3 h-3" /> Uploaded
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {t.aadhaarBack} <span className="text-red-500">*</span>
                    </label>
                    {tenant.aadhaarBack && tenant.aadhaarBack === tenant.aadhaarFront ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                        <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          Auto-detected from 1st file
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTenants((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], aadhaarBack: '' };
                              return copy;
                            })
                          }
                          className="text-[10px] text-emerald-700 underline font-semibold mt-1 block"
                        >
                          Upload separate back side
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) =>
                            handleFileUpload(
                              e,
                              `tenant_${idx}_aadhaar_back`,
                              'aadhaar_back',
                              idx,
                              (b) =>
                                setTenants((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], aadhaarBack: b };
                                  return copy;
                                })
                            )
                          }
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                        />
                        {tenant.aadhaarBack && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                            <Check className="w-3 h-3" /> Uploaded
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {t.panCard} <span className="text-red-500">*</span>
                    </label>
                    {tenant.panFile && tenant.panFile === tenant.aadhaarFront ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                        <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          Auto-detected from 1st file
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setTenants((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], panFile: '' };
                              return copy;
                            })
                          }
                          className="text-[10px] text-emerald-700 underline font-semibold mt-1 block"
                        >
                          Upload separate PAN card
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) =>
                            handleFileUpload(
                              e,
                              `tenant_${idx}_pan`,
                              'pan',
                              idx,
                              (b) =>
                                setTenants((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], panFile: b };
                                  return copy;
                                })
                            )
                          }
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                        />
                        {tenant.panFile && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                            <Check className="w-3 h-3" /> Uploaded
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Extracted/Editable Tenant Text Fields */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Tenant #{idx + 1} Full Name
                      {renderBadges(tenant, 'fullName')}
                    </label>
                    <input
                      type="text"
                      value={tenant.fullName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTenants((prev) => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            fullName: val,
                            name_en: splitNameMaharashtrian(val),
                            aiFields: { ...copy[idx].aiFields, fullName: false },
                            unverifiedFields: { ...copy[idx].unverifiedFields, fullName: false },
                          };
                          return copy;
                        });
                      }}
                      placeholder="Enter / AI Extracted Full Name"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Tenant #{idx + 1} Aadhaar Number
                      {renderBadges(tenant, 'aadhaar')}
                    </label>
                    <input
                      type="text"
                      value={tenant.aadhaar}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTenants((prev) => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            aadhaar: val,
                            aiFields: { ...copy[idx].aiFields, aadhaar: false },
                            unverifiedFields: { ...copy[idx].unverifiedFields, aadhaar: false },
                          };
                          return copy;
                        });
                      }}
                      placeholder="12-digit Aadhaar Number"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Tenant #{idx + 1} PAN Number
                      {renderBadges(tenant, 'pan')}
                    </label>
                    <input
                      type="text"
                      value={tenant.pan}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setTenants((prev) => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            pan: val,
                            aiFields: { ...copy[idx].aiFields, pan: false },
                            unverifiedFields: { ...copy[idx].unverifiedFields, pan: false },
                          };
                          return copy;
                        });
                      }}
                      placeholder="10-character PAN Number"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Tenant #{idx + 1} Native Address
                      {renderBadges(tenant, 'nativeAddress')}
                    </label>
                    <input
                      type="text"
                      value={tenant.nativeAddress}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTenants((prev) => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            nativeAddress: val,
                            aiFields: { ...copy[idx].aiFields, nativeAddress: false },
                            unverifiedFields: { ...copy[idx].unverifiedFields, nativeAddress: false },
                          };
                          return copy;
                        });
                      }}
                      placeholder="Permanent / Native Address"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>
                </div>

                {/* Collapsible IGR Fields for Tenant */}
                {renderIgrPersonFields(
                  tenant,
                  (action: any) =>
                    setTenants((prev) => {
                      const copy = [...prev];
                      copy[idx] = typeof action === 'function' ? action(copy[idx]) : action;
                      return copy;
                    }),
                  `Tenant #${idx + 1}`
                )}
              </div>
            ))}
          </div>

          {/* 3. Witness Documents Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Witness Documents (Exactly 2 Witnesses Required)
            </h3>

            {/* Witness 1 */}
            <div className="space-y-3 border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                Witness 1
                {(extractingCards['witness1_aadhaar_front'] || extractingCards['witness1_aadhaar_back']) && (
                  <span className="text-[11px] text-emerald-600 font-normal flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> AI Extracting...
                  </span>
                )}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Front <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        'witness1_aadhaar_front',
                        'aadhaar_front',
                        'witness1',
                        setWitness1AadhaarFront
                      )
                    }
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                  />
                  {witness1AadhaarFront && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Back <span className="text-red-500">*</span>
                  </label>
                  {witness1AadhaarBack && witness1AadhaarBack === witness1AadhaarFront ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                      <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Auto-detected from 1st file
                      </span>
                      <button
                        type="button"
                        onClick={() => setWitness1AadhaarBack('')}
                        className="text-[10px] text-emerald-700 underline font-semibold mt-1 block"
                      >
                        Upload separate back side
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) =>
                          handleFileUpload(
                            e,
                            'witness1_aadhaar_back',
                            'aadhaar_back',
                            'witness1',
                            setWitness1AadhaarBack
                          )
                        }
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                      />
                      {witness1AadhaarBack && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3" /> Uploaded
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Witness 1 Full Name
                    {renderBadges(witness1, 'fullName')}
                  </label>
                  <input
                    type="text"
                    value={witness1.fullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWitness1((prev) => ({
                        ...prev,
                        fullName: val,
                        name_en: splitNameMaharashtrian(val),
                      }));
                      clearFieldTag(setWitness1, 'fullName');
                    }}
                    placeholder="Enter / AI Extracted Witness 1 Name"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Witness 1 Aadhaar Number
                    {renderBadges(witness1, 'aadhaar')}
                  </label>
                  <input
                    type="text"
                    value={witness1.aadhaar}
                    onChange={(e) => {
                      setWitness1((prev) => ({ ...prev, aadhaar: e.target.value }));
                      clearFieldTag(setWitness1, 'aadhaar');
                    }}
                    placeholder="12-digit Aadhaar Number"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
              </div>

              {/* Collapsible IGR Fields for Witness 1 */}
              {renderIgrPersonFields(witness1, setWitness1, 'Witness 1', false)}
            </div>

            {/* Witness 2 */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                Witness 2
                {(extractingCards['witness2_aadhaar_front'] || extractingCards['witness2_aadhaar_back']) && (
                  <span className="text-[11px] text-emerald-600 font-normal flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> AI Extracting...
                  </span>
                )}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Front <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        'witness2_aadhaar_front',
                        'aadhaar_front',
                        'witness2',
                        setWitness2AadhaarFront
                      )
                    }
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                  />
                  {witness2AadhaarFront && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Back <span className="text-red-500">*</span>
                  </label>
                  {witness2AadhaarBack && witness2AadhaarBack === witness2AadhaarFront ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                      <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Auto-detected from 1st file
                      </span>
                      <button
                        type="button"
                        onClick={() => setWitness2AadhaarBack('')}
                        className="text-[10px] text-emerald-700 underline font-semibold mt-1 block"
                      >
                        Upload separate back side
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) =>
                          handleFileUpload(
                            e,
                            'witness2_aadhaar_back',
                            'aadhaar_back',
                            'witness2',
                            setWitness2AadhaarBack
                          )
                        }
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                      />
                      {witness2AadhaarBack && (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3" /> Uploaded
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Witness 2 Full Name
                    {renderBadges(witness2, 'fullName')}
                  </label>
                  <input
                    type="text"
                    value={witness2.fullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWitness2((prev) => ({
                        ...prev,
                        fullName: val,
                        name_en: splitNameMaharashtrian(val),
                      }));
                      clearFieldTag(setWitness2, 'fullName');
                    }}
                    placeholder="Enter / AI Extracted Witness 2 Name"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Witness 2 Aadhaar Number
                    {renderBadges(witness2, 'aadhaar')}
                  </label>
                  <input
                    type="text"
                    value={witness2.aadhaar}
                    onChange={(e) => {
                      setWitness2((prev) => ({ ...prev, aadhaar: e.target.value }));
                      clearFieldTag(setWitness2, 'aadhaar');
                    }}
                    placeholder="12-digit Aadhaar Number"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
              </div>

              {/* Collapsible IGR Fields for Witness 2 */}
              {renderIgrPersonFields(witness2, setWitness2, 'Witness 2', false)}
            </div>
          </div>

          {/* 4. Electricity Bill Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>
                {t.electricityBill} <span className="text-red-500">*</span>
              </span>
              {extractingCards['electricity_bill'] && (
                <span className="text-[11px] text-emerald-600 font-normal flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> AI Extracting...
                </span>
              )}
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) =>
                handleFileUpload(
                  e,
                  'electricity_bill',
                  'electricity_bill',
                  'property',
                  setElectricityBill
                )
              }
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
            />
            {electricityBill && (
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                <Check className="w-3 h-3" /> Uploaded
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto min-h-[48px] py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="w-full sm:flex-1 min-h-[48px] py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs glow-button transition flex items-center justify-center gap-2 shadow-md text-center"
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                  <span>{t.processingAI}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t.submitIntake}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Client Success Screen */}
      {step === 3 && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-md text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-900">{t.successMessage}</h2>
            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4 shrink-0" />
              {t.waitContactMsg}
            </p>
          </div>

          {/* Token Card */}
          <div className="bg-slate-50 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              {t.tokenAssigned}
            </span>
            <span className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-wider">
              {generatedToken}
            </span>
          </div>

          {/* Sheet Sync Status Alert / Retry Button */}
          {!syncedToSheets && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-amber-900 block">Google Sheet Entry Pending</span>
                <span className="text-[11px] text-amber-700">Your agreement is safely recorded in the database. You can retry pushing the row block to Google Sheets.</span>
              </div>
              <button
                type="button"
                onClick={handleRetrySync}
                disabled={retryingSync}
                className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                {retryingSync ? 'Syncing...' : 'Retry sync'}
              </button>
            </div>
          )}

          {/* WhatsApp Confirmation Box */}
          <div className="text-left bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
              {t.whatsappTemplate}
            </span>
            <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans bg-white p-3 rounded-lg border border-slate-200 shadow-inner">
              {whatsappConfirmationText}
            </pre>
            <button
              onClick={copyWhatsApp}
              className="mt-3 w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition border border-emerald-200 shadow-sm"
            >
              <Copy className="w-4 h-4 text-emerald-600" />
              {copied ? t.copied : t.copyMsg}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
