'use client';

import React, { useState, useMemo } from 'react';
import { translations, Language } from '@/lib/dictionary';
import { calculateTotalAgreementFee } from '@/lib/calculator';
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
  User,
  CreditCard,
  MapPin
} from 'lucide-react';

interface TenantDocState {
  aadhaarFront?: string;
  aadhaarBack?: string;
  pan?: string;
  fullName: string;
  aadhaar: string;
  panNo: string;
  nativeAddress: string;
}

export default function IntakeWizard() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [aiToast, setAiToast] = useState<string | null>(null);

  // Step 1 Form State
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [partyType, setPartyType] = useState<'Landlord' | 'Tenant'>('Tenant');
  const [propertyType, setPropertyType] = useState<'Flat' | 'Room' | 'Shop'>('Flat');
  const [rent, setRent] = useState<string>('');
  const [deposit, setDeposit] = useState<string>('');
  const [durationMonths, setDurationMonths] = useState<string>('11');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Property Address State
  const [buildingName, setBuildingName] = useState<string>('');
  const [flatNo, setFlatNo] = useState<string>('');
  const [floorNo, setFloorNo] = useState<string>('');
  const [road, setRoad] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [village, setVillage] = useState<string>('');
  const [surveyNo, setSurveyNo] = useState<string>('');
  const [furniture, setFurniture] = useState<string>('');

  // Step 2 Parties State (Zero Hardcoded Sample Fallbacks)
  const [landlordName, setLandlordName] = useState<string>('');
  const [landlordAadhaar, setLandlordAadhaar] = useState<string>('');
  const [landlordPan, setLandlordPan] = useState<string>('');
  const [landlordAddress, setLandlordAddress] = useState<string>('');

  const [tenantDocsList, setTenantDocsList] = useState<TenantDocState[]>([
    { fullName: '', aadhaar: '', panNo: '', nativeAddress: '' }
  ]);

  const [witness1, setWitness1] = useState({ fullName: '', aadhaar: '', nativeAddress: '' });
  const [witness2, setWitness2] = useState({ fullName: '', aadhaar: '', nativeAddress: '' });

  // Files State
  const [landlordAadhaarFront, setLandlordAadhaarFront] = useState<string>('');
  const [landlordAadhaarBack, setLandlordAadhaarBack] = useState<string>('');
  const [landlordPanFile, setLandlordPanFile] = useState<string>('');

  const [witness1AadhaarFront, setWitness1AadhaarFront] = useState<string>('');
  const [witness1AadhaarBack, setWitness1AadhaarBack] = useState<string>('');
  const [witness2AadhaarFront, setWitness2AadhaarFront] = useState<string>('');
  const [witness2AadhaarBack, setWitness2AadhaarBack] = useState<string>('');

  const [electricityBill, setElectricityBill] = useState<string>('');

  // Result Token State
  const [generatedToken, setGeneratedToken] = useState<string>('');

  // Live Calculated Total Fee
  const feeCalculation = useMemo(() => {
    return calculateTotalAgreementFee(Number(rent), Number(deposit), Number(durationMonths));
  }, [rent, deposit, durationMonths]);

  // Handle Mobile Number (strictly max 10 digits)
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(cleanDigits);
  };

  // Dynamic Add Tenant
  const handleAddTenant = () => {
    if (tenantDocsList.length < 4) {
      setTenantDocsList([...tenantDocsList, { fullName: '', aadhaar: '', panNo: '', nativeAddress: '' }]);
    }
  };

  // Dynamic Remove Tenant
  const handleRemoveTenant = (index: number) => {
    if (tenantDocsList.length > 1) {
      setTenantDocsList(tenantDocsList.filter((_, i) => i !== index));
    }
  };

  // Upload File & Extract AI Data
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (base64: string) => void,
    docCategory: 'landlord_aadhaar' | 'landlord_pan' | 'tenant_aadhaar' | 'tenant_pan' | 'witness_aadhaar' | 'electricity_bill',
    onExtracted?: (data: any) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      callback(base64);

      // Trigger Gemini AI Extraction
      try {
        const res = await fetch('/api/ai/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64, mimeType: file.type, docCategory }),
        });
        const data = await res.json();
        if (data.success && data.extracted) {
          if (onExtracted) {
            onExtracted(data.extracted);
          }
          const info = data.extracted.fullName || data.extracted.buildingName || data.extracted.aadhaarNumber || 'Document Data';
          if (info) {
            setAiToast(`✨ AI Extracted: ${info}`);
            setTimeout(() => setAiToast(null), 4500);
          }
        }
      } catch (err) {
        console.warn("AI extraction notice:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper to update specific tenant text state
  const updateTenantState = (index: number, key: keyof TenantDocState, value: string) => {
    setTenantDocsList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (mobileNumber.length !== 10 || !rent.trim() || !deposit.trim() || !durationMonths.trim() || !startDate.trim()) {
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

    tenantDocsList.forEach((tenant, idx) => {
      if (!tenant.aadhaarFront) missing.push(`Tenant #${idx + 1} Aadhaar (Front)`);
      if (!tenant.aadhaarBack) missing.push(`Tenant #${idx + 1} Aadhaar (Back)`);
      if (!tenant.pan) missing.push(`Tenant #${idx + 1} PAN Card`);
    });

    if (!witness1AadhaarFront) missing.push('Witness 1 Aadhaar (Front)');
    if (!witness2AadhaarFront) missing.push('Witness 2 Aadhaar (Front)');
    if (!electricityBill) missing.push('Electricity Bill');

    return missing;
  };

  // Submit Intake Form
  const handleSubmit = async () => {
    const missing = getMissingDocuments();
    if (missing.length > 0) {
      setErrorMessage(`Please upload the following missing document(s): ${missing.join(', ')}`);
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      const payload = {
        mobileNumber,
        landlord: {
          type: 'Landlord',
          fullName: landlordName.trim() || 'Landlord / Owner',
          aadhaar: landlordAadhaar.trim() || '',
          pan: landlordPan.trim() || '',
          mobile: mobileNumber,
          nativeAddress: landlordAddress.trim() || '',
        },
        tenants: tenantDocsList.map((t, i) => ({
          type: 'Tenant',
          fullName: t.fullName.trim() || `Tenant #${i + 1}`,
          aadhaar: t.aadhaar.trim() || '',
          pan: t.panNo.trim() || '',
          nativeAddress: t.nativeAddress.trim() || '',
        })),
        witnesses: [
          {
            type: 'Witness',
            fullName: witness1.fullName.trim() || 'Witness 1',
            aadhaar: witness1.aadhaar.trim() || '',
            nativeAddress: witness1.nativeAddress.trim() || '',
          },
          {
            type: 'Witness',
            fullName: witness2.fullName.trim() || 'Witness 2',
            aadhaar: witness2.aadhaar.trim() || '',
            nativeAddress: witness2.nativeAddress.trim() || '',
          },
        ],
        propertyDetails: {
          propertyType,
          buildingName: buildingName.trim(),
          flatNo: flatNo.trim(),
          floorNo: floorNo.trim(),
          surveyNo: surveyNo.trim(),
          areaSqFt: '250',
          road: road.trim(),
          landmark: landmark.trim(),
          village: village.trim() || 'Pune',
          city: 'Pune',
          pincode: '412207',
          furnitureDetails: furniture.trim(),
        },
        financials: {
          rent: Number(rent),
          deposit: Number(deposit),
          tenureMonths: Number(durationMonths),
          startDate,
          fee: feeCalculation.totalAmount,
        },
        files: {
          landlordAadhaarFront,
          landlordAadhaarBack,
          landlordPan: landlordPanFile,
          electricityBill,
          witness1AadhaarFront,
          witness1AadhaarBack,
          witness2AadhaarFront,
          witness2AadhaarBack,
        },
      };

      const res = await fetch('/api/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (resData.success) {
        setGeneratedToken(resData.tokenNumber);
        setStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      alert("Error submitting intake form. Please check network connection.");
    } finally {
      setLoading(false);
    }
  };

  const whatsappConfirmationText = `Hello! I have submitted my Rent Agreement details.\nToken Number: *${generatedToken}*\nMobile: ${mobileNumber}\nProperty: ${flatNo || ''} ${buildingName || ''}, Pune.\nPlease update me regarding further contact.`;

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(whatsappConfirmationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Toast Notification for AI Extraction */}
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

      {/* Progress Bar (Starts at 20%) */}
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

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2 shadow-sm leading-relaxed">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Basic Details */}
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

          {/* Clean Responsive Money Display Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-950 block">
                  {t.totalCalculatedFee}
                </span>
                <span className="text-[11px] text-emerald-700">Calculated automatically for your lease terms</span>
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
            <strong>Note:</strong> Upload document cards below. Gemini AI will automatically extract and auto-fill the legal names, Aadhaar numbers, PAN numbers, and native addresses from your uploaded documents. You can also inspect or edit any field below.
          </p>

          {/* 1. Landlord Documents & AI Fields */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{t.landlordDocs}</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t.aadhaarFront} <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setLandlordAadhaarFront, 'landlord_aadhaar', (ext) => {
                    if (ext.fullName) setLandlordName(ext.fullName);
                    if (ext.aadhaarNumber) setLandlordAadhaar(ext.aadhaarNumber);
                    if (ext.nativeAddress) setLandlordAddress(ext.nativeAddress);
                  })}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                />
                {landlordAadhaarFront && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t.aadhaarBack} <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setLandlordAadhaarBack, 'landlord_aadhaar')}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                />
                {landlordAadhaarBack && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t.panCard} <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setLandlordPanFile, 'landlord_pan', (ext) => {
                    if (ext.panNumber) setLandlordPan(ext.panNumber);
                  })}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                />
                {landlordPanFile && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
              </div>
            </div>

            {/* Extracted/Editable Landlord Text Fields */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Landlord Full Name (AI Extracted)</label>
                <input
                  type="text"
                  value={landlordName}
                  onChange={(e) => setLandlordName(e.target.value)}
                  placeholder="Enter / AI Extracted Full Name"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Aadhaar Number (AI Extracted)</label>
                <input
                  type="text"
                  value={landlordAadhaar}
                  onChange={(e) => setLandlordAadhaar(e.target.value)}
                  placeholder="12-digit Aadhaar Number"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">PAN Number (AI Extracted)</label>
                <input
                  type="text"
                  value={landlordPan}
                  onChange={(e) => setLandlordPan(e.target.value.toUpperCase())}
                  placeholder="10-character PAN Number"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Native Address (AI Extracted)</label>
                <input
                  type="text"
                  value={landlordAddress}
                  onChange={(e) => setLandlordAddress(e.target.value)}
                  placeholder="Permanent / Native Address"
                  className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                />
              </div>
            </div>
          </div>

          {/* 2. Multi-Tenant Documents & AI Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                {t.tenantDocs.replace('{no}', `(Total: ${tenantDocsList.length})`)}
              </h3>
              {tenantDocsList.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddTenant}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.addTenant}
                </button>
              )}
            </div>

            {tenantDocsList.map((tenant, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-slate-800">Tenant #{idx + 1}</span>
                  {tenantDocsList.length > 1 && (
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
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, (b) => updateTenantState(idx, 'aadhaarFront', b), 'tenant_aadhaar', (ext) => {
                        if (ext.fullName) updateTenantState(idx, 'fullName', ext.fullName);
                        if (ext.aadhaarNumber) updateTenantState(idx, 'aadhaar', ext.aadhaarNumber);
                        if (ext.nativeAddress) updateTenantState(idx, 'nativeAddress', ext.nativeAddress);
                      })}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                    />
                    {tenant.aadhaarFront && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {t.aadhaarBack} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, (b) => updateTenantState(idx, 'aadhaarBack', b), 'tenant_aadhaar')}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                    />
                    {tenant.aadhaarBack && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {t.panCard} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, (b) => updateTenantState(idx, 'pan', b), 'tenant_pan', (ext) => {
                        if (ext.panNumber) updateTenantState(idx, 'panNo', ext.panNumber);
                      })}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                    />
                    {tenant.pan && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
                  </div>
                </div>

                {/* Extracted/Editable Tenant Text Fields */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Tenant #{idx + 1} Full Name (AI Extracted)</label>
                    <input
                      type="text"
                      value={tenant.fullName}
                      onChange={(e) => updateTenantState(idx, 'fullName', e.target.value)}
                      placeholder="Enter / AI Extracted Tenant Name"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Tenant #{idx + 1} Aadhaar Number</label>
                    <input
                      type="text"
                      value={tenant.aadhaar}
                      onChange={(e) => updateTenantState(idx, 'aadhaar', e.target.value)}
                      placeholder="12-digit Aadhaar Number"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Tenant #{idx + 1} PAN Number</label>
                    <input
                      type="text"
                      value={tenant.panNo}
                      onChange={(e) => updateTenantState(idx, 'panNo', e.target.value.toUpperCase())}
                      placeholder="10-character PAN Number"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Tenant #{idx + 1} Native Address</label>
                    <input
                      type="text"
                      value={tenant.nativeAddress}
                      onChange={(e) => updateTenantState(idx, 'nativeAddress', e.target.value)}
                      placeholder="Permanent / Native Address"
                      className="w-full glass-input px-2.5 py-1.5 rounded-lg text-xs mt-0.5"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 3. Witnesses Documents & AI Fields */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Witness Documents</h3>
            
            {/* Witness 1 */}
            <div className="space-y-3 border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-800">Witness 1</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Front <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setWitness1AadhaarFront, 'witness_aadhaar', (ext) => {
                      setWitness1((prev) => ({
                        ...prev,
                        fullName: ext.fullName || prev.fullName,
                        aadhaar: ext.aadhaarNumber || prev.aadhaar,
                        nativeAddress: ext.nativeAddress || prev.nativeAddress,
                      }));
                    })}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                  />
                  {witness1AadhaarFront && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Back (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setWitness1AadhaarBack, 'witness_aadhaar')}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                  />
                  {witness1AadhaarBack && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Witness 1 Full Name</label>
                  <input
                    type="text"
                    value={witness1.fullName}
                    onChange={(e) => setWitness1({ ...witness1, fullName: e.target.value })}
                    placeholder="Enter / AI Extracted Witness 1 Name"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Witness 1 Aadhaar Number</label>
                  <input
                    type="text"
                    value={witness1.aadhaar}
                    onChange={(e) => setWitness1({ ...witness1, aadhaar: e.target.value })}
                    placeholder="12-digit Aadhaar Number"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Witness 2 */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800">Witness 2</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Front <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setWitness2AadhaarFront, 'witness_aadhaar', (ext) => {
                      setWitness2((prev) => ({
                        ...prev,
                        fullName: ext.fullName || prev.fullName,
                        aadhaar: ext.aadhaarNumber || prev.aadhaar,
                        nativeAddress: ext.nativeAddress || prev.nativeAddress,
                      }));
                    })}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                  />
                  {witness2AadhaarFront && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aadhaar Back (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setWitness2AadhaarBack, 'witness_aadhaar')}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
                  />
                  {witness2AadhaarBack && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Witness 2 Full Name</label>
                  <input
                    type="text"
                    value={witness2.fullName}
                    onChange={(e) => setWitness2({ ...witness2, fullName: e.target.value })}
                    placeholder="Enter / AI Extracted Witness 2 Name"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Witness 2 Aadhaar Number</label>
                  <input
                    type="text"
                    value={witness2.aadhaar}
                    onChange={(e) => setWitness2({ ...witness2, aadhaar: e.target.value })}
                    placeholder="12-digit Aadhaar Number"
                    className="w-full glass-input px-2 py-1 rounded text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Electricity Bill */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
              {t.electricityBill} <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileUpload(e, setElectricityBill, 'electricity_bill', (ext) => {
                if (ext.buildingName && !buildingName) setBuildingName(ext.buildingName);
                if (ext.flatNo && !flatNo) setFlatNo(ext.flatNo);
                if (ext.surveyNo && !surveyNo) setSurveyNo(ext.surveyNo);
              })}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200"
            />
            {electricityBill && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1"><Check className="w-3 h-3"/> Uploaded</span>}
          </div>

          {/* Cleaned Button Layout Row */}
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
