import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { DocType, ExtractionResult, NameSplit, AddressSplit } from '@/types';

export function splitNameMaharashtrian(fullName: string): NameSplit {
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 0) return { surname: '', first: '', middle: '' };
  if (parts.length === 1) return { surname: '', first: parts[0], middle: '' };
  if (parts.length === 2) return { surname: parts[1], first: parts[0], middle: '' };
  return {
    first: parts[0],
    surname: parts[parts.length - 1],
    middle: parts.slice(1, parts.length - 1).join(' '),
  };
}

export function deriveSalutation(gender?: string): 'Mr' | 'Mrs' | 'Miss' {
  if (!gender) return 'Mr';
  const g = gender.toLowerCase().trim();
  if (g.includes('female') || g.includes('woman') || g === 'f') return 'Mrs';
  return 'Mr';
}

export function computeAge(dobStr?: string): string {
  if (!dobStr) return '';
  const clean = dobStr.trim();
  const ddmmyyyy = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const birthDate = new Date(year, month, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 && age < 130 ? `${age}` : '';
  }

  const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const birthYear = parseInt(yearMatch[1], 10);
    const currentYear = new Date().getFullYear();
    const roughAge = currentYear - birthYear;
    return roughAge > 0 && roughAge < 130 ? `${roughAge}` : '';
  }

  return '';
}

export async function processDocumentWithGemini(
  fileBase64: string,
  mimeType: string,
  docType: DocType
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return {
      fields: {},
      confidence: 0,
      warnings: ['GEMINI_API_KEY is not configured in the server environment.'],
    };
  }

  const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const candidateModels = [
    configuredModel,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
  ].filter((v, i, a) => a.indexOf(v) === i);

  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');

  const docPrompts: Record<DocType, string> = {
    aadhaar_front: `You are extracting data from an Indian Aadhaar Card (FRONT side).
Extract:
1. "fullName": exact English name printed on the card.
2. "dob": date of birth (e.g. DD/MM/YYYY) or year of birth.
3. "gender": "Male", "Female", or "Others".
4. "aadhaarNumber": 12-digit Aadhaar number (or masked, e.g. XXXX XXXX 1234).
5. "confidence": estimated accuracy confidence score between 0.0 and 1.0.
Output valid JSON only with keys: fullName, dob, gender, aadhaarNumber, confidence.`,

    aadhaar_back: `You are extracting data from an Indian Aadhaar Card (BACK side).
Extract:
1. "fatherHusbandName": father/husband name (e.g., C/O, S/O, W/O, D/O).
2. "nativeAddress": the full complete address string formatted as printed.
3. "addressParts": {
     "building": flat/room/building/society name if clearly present,
     "road": street/road name or house/gala name,
     "location": landmark, locality, area, or nearby reference,
     "village_city": village or city name (e.g. Pune, Wagholi, Vimannagar),
     "district": district (e.g. Pune),
     "state": state (e.g. Maharashtra),
     "pincode": 6-digit postal code
   }
4. "aadhaarNumber": 12-digit Aadhaar number if visible.
5. "confidence": estimated accuracy score between 0.0 and 1.0.
Output valid JSON only with keys: fatherHusbandName, nativeAddress, addressParts, aadhaarNumber, confidence.`,

    pan: `You are extracting data from an Indian PAN Card.
Extract:
1. "panNumber": 10-character alphanumeric PAN number (e.g. ABCDE1234F).
2. "fullName": name of the cardholder as printed.
3. "fatherHusbandName": father's name as printed.
4. "dob": date of birth in DD/MM/YYYY format.
5. "confidence": estimated accuracy score between 0.0 and 1.0.
Output valid JSON only with keys: panNumber, fullName, fatherHusbandName, dob, confidence.`,

    electricity_bill: `You are extracting data from an Indian / Maharashtra Property Document (Electricity Bill, Index II, Sale Deed, Property Tax, or Maintenance Receipt).
Extract:
1. "buildingName": building, apartment, wing, or society name.
2. "flatNo": flat, apartment, shop, unit or gala number.
3. "floorNo": floor number if mentioned.
4. "village": village, locality, town, or area name (e.g. Wagholi, Wakad, Kharadi, Hinjewadi, Hadapsar, Kothrud, Pune, etc.).
5. "surveyNo": survey number, CTS number, or Gat number if mentioned.
6. "consumerName": name of the owner / consumer / billing party.
7. "nativeAddress": full address printed on the document.
8. "confidence": estimated accuracy score between 0.0 and 1.0.
Output valid JSON only with keys: buildingName, flatNo, floorNo, village, surveyNo, consumerName, nativeAddress, confidence.`,
  };

  const prompt = `${docPrompts[docType] || docPrompts.aadhaar_front}
Do not enclose in markdown block quotes. Respond ONLY with a valid JSON object.`;

  const inlinePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: mimeType || 'image/jpeg',
    },
  };

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const response = await model.generateContent([prompt, inlinePart]);
      const rawText = response.response.text().trim();
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const warnings: string[] = [];
      let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.90;
      if (confidence > 1.0) confidence = confidence / 100;

      const fields: ExtractionResult['fields'] = {};

      if (parsed.fullName) {
        const cleanName = String(parsed.fullName).trim();
        fields.fullName = cleanName;
        fields.name_en = splitNameMaharashtrian(cleanName);
      }

      if (parsed.consumerName) {
        fields.consumerName = parsed.consumerName.trim();
      }

      if (parsed.aadhaarNumber) {
        const cleanAadhaar = String(parsed.aadhaarNumber).replace(/\s+/g, '');
        fields.aadhaarNumber = cleanAadhaar;
        if (!/^\d{12}$/.test(cleanAadhaar) && !/^[X\d]{12}$/i.test(cleanAadhaar)) {
          warnings.push('Aadhaar number should be exactly 12 digits or standard masked format.');
          if (confidence >= 0.85) confidence = 0.80;
        }
      }

      if (parsed.panNumber) {
        const cleanPan = String(parsed.panNumber).toUpperCase().trim();
        fields.panNumber = cleanPan;
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
          warnings.push('PAN number does not match standard 10-character format (5 letters, 4 digits, 1 letter).');
          if (confidence >= 0.85) confidence = 0.80;
        }
      }

      if (parsed.dob) {
        fields.dob = String(parsed.dob).trim();
        const derivedAge = computeAge(fields.dob);
        if (derivedAge) {
          fields.age = derivedAge;
        }
      }

      if (parsed.gender) {
        const g = String(parsed.gender).trim();
        fields.gender = g.toLowerCase().startsWith('f') ? 'Female' : 'Male';
        fields.salutation = deriveSalutation(fields.gender);
      }

      if (parsed.fatherHusbandName) {
        fields.fatherHusbandName = String(parsed.fatherHusbandName).trim();
      }

      if (parsed.nativeAddress) {
        fields.nativeAddress = String(parsed.nativeAddress).trim();
      }

      if (parsed.buildingName) fields.buildingName = String(parsed.buildingName).trim();
      if (parsed.flatNo) fields.flatNo = String(parsed.flatNo).trim();
      if (parsed.floorNo) fields.floorNo = String(parsed.floorNo).trim();
      if (parsed.surveyNo) fields.surveyNo = String(parsed.surveyNo).trim();
      if (parsed.village) fields.village = String(parsed.village).trim();

      if (parsed.addressParts) {
        const parts = parsed.addressParts;
        const address_en: AddressSplit = {
          building: parts.building || fields.buildingName || '',
          flat_no: parts.flat_no || fields.flatNo || '',
          floor_no: parts.floor_no || fields.floorNo || '',
          road: parts.road || '',
          location: parts.location || '',
          pincode: parts.pincode ? String(parts.pincode).replace(/\D/g, '').slice(0, 6) : '',
          village_city: parts.village_city || '',
          district: parts.district || 'Pune',
          state: parts.state || 'Maharashtra',
        };

        if (address_en.pincode && !/^\d{6}$/.test(address_en.pincode)) {
          warnings.push('Pincode should be exactly 6 digits.');
          if (confidence >= 0.85) confidence = 0.80;
        }

        fields.address_en = address_en;
      }

      if (confidence < 0.85) {
        warnings.push('Low AI confidence rating (< 85%). Please verify extracted fields.');
      }

      return {
        fields,
        confidence: Math.round(confidence * 100) / 100,
        warnings,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`Extraction error with model ${modelName}:`, err?.message || err);
    }
  }

  return {
    fields: {},
    confidence: 0,
    warnings: [
      lastError?.message
        ? `Document extraction failed: ${lastError.message}`
        : 'Could not extract text from document. Please verify image clarity or type manually.',
    ],
  };
}
