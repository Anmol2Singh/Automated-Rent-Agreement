You are an expert full-stack developer and system architect. Build a secure, lightweight custom web application tailored for a rent agreement registration agency in Pune, Maharashtra. The system must automate client intake, process documents using AI, generate local tracking tokens, and prepare data for state-specific e-registration formats.

---

### 1. SYSTEM CORE ARCHITECTURE & USER INTERFACES

Create a hybrid, responsive web application with a single unified database but two distinct portal flows:

#### A. Client Intake Flow (Mobile-Optimized URL)
- A minimalist, step-by-step wizard interface designed for mobile web browsers.
- Supports English and Marathi text toggles. Show progress bar at top, starting at 20% (Since we already took mobile number).
- **Step 1:** Basic Details (Mobile Number, Landlord/Tenant selection, Property Type {Flat/Room/Shop}, Rent Amount, Deposit, Duration in Months, Agreement Start Date, Property Address {Building/Society Name, Flat/Room No, Floor No, Road, Landmark, Village, Survey No.}, Furnitures (if any- optional)).
- **Step 2:** Document Upload Page. Large buttons optimized for smartphone cameras to snap and upload:
  - Landlord Aadhaar (Front/Back) & PAN
  - Tenant Aadhaar (Front/Back) & PAN
  - Witness-1 Aadhar (Front/Back)
  - Witness-2 Aadhar (Front/Back)
  - Property Electricity Bill.
- **Step 3:** Success page displaying a uniquely generated Token Number and an automated SMS/WhatsApp-ready text template.

#### B. Staff Dashboard Panel (Desktop-Optimized)
- A comprehensive live dashboard displaying a queue of all active cases sorted by Token Number.
- **Status Indicators:** "Docs Uploaded", "AI Processing", "Draft Ready", "Biometrics Scheduled", "Completed".
- An "Add New Case" quick-entry form replicating the client wizard, but optimized for rapid desktop data entry and bulk multi-page PDF scanning uploads.
- **Action Buttons per Token:** 
  1. "Review Extracted Data" (Side-by-side view of uploaded image vs. text fields).
  2. "Download Word/PDF Draft".
  3. "Export Data for IGR Autofill".

---

### 2. DATA SCHEMA & AUTOMATED TOKEN LOGIC

#### Token Generation Algorithm:
- Upon clicking "Submit" on any intake form, the backend must instantly generate a unique token.
- **Format:** `PNE-[YYYY]-[4-Digit Sequential Number]` (e.g., `PNE-2026-0412`).
- The sequential counter resets annually on January 1st.

#### Database Schema (SQL/NoSQL structure):
- **TokenID:** String (Primary Key)
- **Status:** Enum (Pending_AI, Verification, Draft_Ready, Completed)
- **Parties:** Array of Objects [
    { Type: "Landlord" | "Tenant | "Witness", FullName: String, Aadhaar: String, PAN: String, NativeAddress: String, Mobile: String, Gender: String, DOB: Date, Age: Number }
  ]
- **PropertyDetails:** { BuildingName: String, FlatNo: Number, Floor: String, SurveyNo: String, Area_SqFt: Number, Road: String, Landmark: String, Village: String, City: String, Pincode: Number }
- **Financials:** { Rent: Number, Deposit: Number, MaintenanceIncluded: Boolean, DurationMonths: Number, StartDate: Date }
- **Files:** { Aadhaar_Paths: Array, Electricity_Bill_Path: String, Draft_Path: String }

---

### 3. AI DATA EXTRACTION (OCR/LLM INTEGRATION)

Write a mock/pluggable backend service module (Python FastAPI or Node.js) that routes uploaded files to an AI model (such as OpenAI GPT-4o or Google Cloud Document AI) using structured JSON output (`response_format: { type: "json_object" }`).

The AI parsing logic must explicitly extract:
1. **From Aadhaar:** Exact legal English spellings of names, fathers/husbands' names, birth years, age, and full formatted permanent addresses.
2. **From PAN:** 10-character alphanumeric PAN number matching the name string.
3. **From Electricity Bill:** Property description, flat/shop numbers, floor layout, building scheme name, Taluka (e.g., Haveli), and precise bounded areas.

Include validation logic: Flag the token status as "Verification Required" if the AI confidence rating is below 85% or if text structures fail regex matching (e.g., checking for exactly 12 digits for Aadhaar).

---

### 4. DRAFT GENERATION ENGINE & AUTOFILL EXPORT

#### A. Document Templating:
- Implement a backend document compilation script using `docx-templates` (Node) or `python-docx` / `docxtpl` (Python).
- It must inject the extracted variables into a pre-formatted template of a Maharashtra Leave and License Agreement (including standard clauses for Pune municipal limits, maintenance handling, security deposits, and lock-in periods).

#### B. Government Portal (IGR Maharashtra) Compatibility Layer:
- Create a data exporter endpoint that formats the structured case file into a clean JSON/CSV packet. 
- Map fields explicitly to correspond with standard IGR web forms: Party Type, Identity Identifiers, Regional Property Identifiers (District: Pune, Taluka, Village, Property Type).
- (Optional) Provide a boilerplate template for a Manifest V3 Google Chrome Extension background script capable of reading this JSON schema and auto-populating fields on a web page DOM matching standard state registry fields.

---

### 5. DELIVERY REQUIREMENTS
Provide a clean, modular code setup using a modern web development stack (e.g., Next.js for unified frontend/backend, or a React frontend paired with a Python FastAPI backend). Prioritize highly visual CSS, fast data parsing speeds, mobile responsiveness, clear data privacy/security logging for Indian identity documents, and easy environment configurations (`.env`) for API keys.
