import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedDocumentData {
  documentType: 'Aadhaar' | 'PAN' | 'ElectricityBill' | 'Unknown';
  fullName?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  fatherHusbandName?: string;
  dob?: string;
  age?: string;
  gender?: string;
  nativeAddress?: string;
  buildingName?: string;
  flatNo?: string;
  floorNo?: string;
  surveyNo?: string;
  areaSqFt?: string;
  taluka?: string;
  pincode?: string;
  confidenceScore: number;
  validationPassed: boolean;
}

export async function extractDocumentData(
  fileBase64: string,
  mimeType: string,
  docCategory: 'landlord_aadhaar' | 'landlord_pan' | 'tenant_aadhaar' | 'tenant_pan' | 'witness_aadhaar' | 'electricity_bill'
): Promise<ExtractedDocumentData> {
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    console.warn("No GEMINI_API_KEY set in environment.");
    return getEmptyExtractionData(docCategory);
  }

  const prompt = `You are an expert OCR parser for official Indian identity documents (Aadhaar Card, PAN Card) and Electricity Bills in Maharashtra.
  Extract the exact text printed on this document image as structured JSON format:
  {
    "documentType": "Aadhaar" | "PAN" | "ElectricityBill",
    "fullName": string (Full legal English name as printed),
    "aadhaarNumber": string (exactly 12 digits, no spaces),
    "panNumber": string (exactly 10 alphanumeric characters),
    "fatherHusbandName": string,
    "dob": string (DD/MM/YYYY),
    "age": string,
    "gender": string ("Male" | "Female"),
    "nativeAddress": string (Full native/permanent address printed on card),
    "buildingName": string,
    "flatNo": string,
    "floorNo": string,
    "surveyNo": string,
    "areaSqFt": string,
    "taluka": string,
    "pincode": string,
    "confidenceScore": number (0 to 100)
  }
  Respond ONLY with valid JSON. Do not include markdown code block syntax.`;

  const imagePart = {
    inlineData: {
      data: fileBase64.replace(/^data:[^;]+;base64,/, ''),
      mimeType: mimeType || 'image/jpeg',
    },
  };

  const modelNames = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro-vision'];

  for (const modelName of modelNames) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text().trim();
      
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      let isValid = true;
      if (parsed.aadhaarNumber) {
        const cleanAadhaar = parsed.aadhaarNumber.replace(/\s+/g, '');
        if (!/^\d{12}$/.test(cleanAadhaar)) {
          isValid = false;
        }
      }
      if (parsed.panNumber) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(parsed.panNumber.toUpperCase())) {
          isValid = false;
        }
      }

      console.log(`✅ Gemini OCR successfully extracted data using model ${modelName}:`, parsed.fullName || parsed.aadhaarNumber || parsed.buildingName);

      return {
        documentType: parsed.documentType || 'Unknown',
        fullName: parsed.fullName || '',
        aadhaarNumber: parsed.aadhaarNumber ? parsed.aadhaarNumber.replace(/\s+/g, '') : '',
        panNumber: parsed.panNumber ? parsed.panNumber.toUpperCase() : '',
        fatherHusbandName: parsed.fatherHusbandName || '',
        dob: parsed.dob || '',
        age: parsed.age || '',
        gender: parsed.gender || '',
        nativeAddress: parsed.nativeAddress || '',
        buildingName: parsed.buildingName || '',
        flatNo: parsed.flatNo || '',
        floorNo: parsed.floorNo || '',
        surveyNo: parsed.surveyNo || '',
        areaSqFt: parsed.areaSqFt || '',
        taluka: parsed.taluka || '',
        pincode: parsed.pincode || '',
        confidenceScore: parsed.confidenceScore ?? 92,
        validationPassed: isValid,
      };
    } catch (error) {
      console.warn(`Gemini model ${modelName} extraction attempt notice:`, error);
    }
  }

  return getEmptyExtractionData(docCategory);
}

function getEmptyExtractionData(docCategory: string): ExtractedDocumentData {
  return {
    documentType: docCategory.includes('pan') ? 'PAN' : docCategory.includes('bill') ? 'ElectricityBill' : 'Aadhaar',
    fullName: '',
    aadhaarNumber: '',
    panNumber: '',
    fatherHusbandName: '',
    dob: '',
    age: '',
    gender: '',
    nativeAddress: '',
    buildingName: '',
    flatNo: '',
    floorNo: '',
    surveyNo: '',
    areaSqFt: '',
    taluka: '',
    pincode: '',
    confidenceScore: 0,
    validationPassed: false,
  };
}
