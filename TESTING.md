# Manual Testing Guide

Follow these steps to verify all features and acceptance criteria.

---

## 1. Test AI Document Extraction (`POST /api/extract`)

1. Open [http://localhost:3000](http://localhost:3000).
2. Enter a 10-digit mobile number, select rent/deposit/dates, and proceed to **Step 2**.
3. In the **Landlord Documents** card:
   - Select an **Aadhaar Front** image.
   - **Verification**:
     - Card shows an inline spinner `AI Extracting...`
     - Gemini parses the Full Name and 12-digit Aadhaar number.
     - Extracted inputs display a small green `AI` badge.
     - Collapsible **IGR Breakdown Fields** show the split name (`First Name`, `Middle Name`, `Surname`), `Age`, `Gender`, and `Salutation`.
   - Select an **Aadhaar Back** image for the same landlord.
   - **Verification**:
     - Address fields populate automatically without overwriting the front name or Aadhaar.
     - Sibling fields merge seamlessly into one landlord record.
   - Edit any input manually:
     - The green `AI` tag drops immediately, confirming manual override.
   - Select an unreadable or blurry image:
     - Shows a toast notification, keeps fields editable, and does not block the workflow.

---

## 2. Test Client Submit & Atomic Token Generation

1. Upload Landlord documents (Front, Back, PAN).
2. Upload Tenant #1 documents (Front, Back, PAN).
3. Upload Witness 1 & Witness 2 Aadhaar documents (Front & Back).
4. Upload Electricity Bill.
5. Click **Submit Details & Generate Token**:
   - **Verification**:
     - Generates token format `PNE-YYYY-NNNN` (e.g. `PNE-2026-0001`).
     - Case row inserted into `agreements` table with status `'Docs Uploaded'`.
     - Uploaded files saved in private Supabase Storage bucket `agreement-docs` under `{token}/{role}-{docType}.ext`.
     - Success screen (Step 3) displays the generated token and WhatsApp template.
     - If Google Sheet webhook is active, pushes the 7-row block; if pending, displays a **"Retry sync"** button.

---

## 3. Test Google Sheet 7-Row Block & ExcelJS Export

1. Open the connected Google Sheet:
   - **Verification**:
     - Appended agreement occupies exactly 7 rows.
     - **Row 0 (Green header)**: Serial number, Date, Landlord Name, Witness 1, Witness 2, blank GRN cell (yellow), Tenant 1, 2, 3...
     - **Row 1**: Rent, Property Type, Landlord Aadhaar, Witness Aadhaar, Tenant Aadhaar.
     - **Row 2**: Security Deposit, Flat No, Landlord PAN, Tenant PAN.
     - **Row 3**: Tenure ("11M"), Area ("250sq.ft"), Landlord Age ("42y"), Witness Age, Tenant Age ("26y").
     - **Row 4**: Tenant Mobile, Landlord Mobile.
     - **Row 5**: Blank.
     - **Row 6**: Tall row with text wrapping containing full addresses.
     - All Aadhaar/PAN/mobile numbers are stored as plain text (no scientific notation like `1.23E+11`).
2. Go to [http://localhost:3000/admin](http://localhost:3000/admin):
   - Click **Export .xlsx (ExcelJS)**.
   - Open downloaded `.xlsx` file and verify the identical 7-row block layout, green header, and yellow cell.

---

## 4. Test Staff Dashboard & Actions

1. Open [http://localhost:3000/admin](http://localhost:3000/admin).
2. Log in with an allow-listed staff email.
3. In the cases queue:
   - Click **Edit**: update rent or tenant name and click **Save Changes** (`PATCH /api/cases/[token]`).
   - Click **GRN/PRN**: enter `0726305705334` and save. Verify the yellow cell in Google Sheet updates.
   - Click **Re-sync**: re-pushes the 7-row block to the sheet and marks the case as `Synced`.
   - Click **Export IGR JSON**: downloads sanitized English-only JSON without full Aadhaar or Marathi fields.

---

## 5. Test Chrome Extension Autofill & Scan

1. Load unpacked extension from `chrome-extension/`.
2. Open Maharashtra IGR portal or a local test page:
   - Click extension icon in toolbar.
   - Enter token (e.g. `PNE-2026-0001`) and click **Load**.
   - Verify checklist displays Property, Owner, Tenants, and Identifiers.
   - Click **Scan This Page**: verifies control count and copies JSON dump to clipboard.
   - Click **Fill Current Page**: verifies inputs fill with simulated typing and portal Marathi sibling boxes auto-populate.
   - Click **Capture GRN**: reads "Token No:" header from page and updates DB & Google Sheet.
