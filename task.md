You are working inside my existing Next.js + Supabase repo "Automated-Rent-Agreement". The UI is already built (Step 1: Basic Agreement & Property Details, Step 2: Upload ID & Property Documents with Landlord / Tenant #N / Witness 1-2 cards and AI-extracted fields). Do NOT redesign the UI. Wire up the backend and automation.

## STEP 0 - Read first, change nothing yet
Read: package.json, schema.sql, idea.md, google-sheets-script.js, everything under app/, components/, lib/, types/ and chrome-extension/. Summarize in 10 lines what already exists and what is missing. Reuse existing components, types and the Supabase client. Keep the existing agreements table columns (landlord/tenants/witnesses/property_details/financials/grn_details/files JSONB, synced_to_sheets); add migrations only where needed.

## TASK 1 - AI document extraction (auto-fetch on file select)
- Create server route POST /api/extract. Use the Gemini API (key in GEMINI_API_KEY, model name in GEMINI_MODEL env var, never exposed to the browser). Use structured JSON output with a response schema.
- Input: one image or PDF + docType in {aadhaar_front, aadhaar_back, pan, electricity_bill}. Compress images client-side (max ~1600px, JPEG 0.8) before upload.
- Extract:
  - aadhaar_front: full name (English, exact spelling), DOB or year of birth, gender, 12-digit Aadhaar number.
  - aadhaar_back: full address (single formatted string plus parts: house, locality, village/city, district, state, pincode), father/husband name if present, Aadhaar number.
  - pan: PAN number, name, father's name, DOB.
  - electricity_bill (optional): consumer name, address, flat/shop no, building name.
- Return {fields, confidence 0-1, warnings[]}.
- Validation: Aadhaar = exactly 12 digits (strip spaces, allow masked), PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/, pincode = 6 digits. Compute Age from DOB/year. If confidence < 0.85 or regex fails, mark the field with an amber "Verify" badge.
- Frontend: when a file is chosen, show a spinner on that card, call /api/extract, merge results into the existing fields (Full Name, Aadhaar Number, PAN Number, Native Address, Age, Gender). Aadhaar front + back for the same person must merge into one record. AI-filled fields stay fully editable and show a small "AI" tag; if the user edits one, drop the tag. Cache results so re-renders don't re-call the API.
- Support multiple tenants (the "+ Add Another Tenant" button) and exactly 2 witnesses (witness PAN not required, Aadhaar back optional). Add optional Mobile per tenant/landlord.
- Handle failures gracefully (blurry image, timeout): show a toast, let the user type manually, never block the flow.

## TASK 2 - Submit flow
On "Submit":
1. Validate required fields (client mobile 10 digits, rent, deposit, tenure, start date, landlord + at least one tenant with name and Aadhaar, 2 witnesses with name and Aadhaar).
2. Generate the internal token atomically in Postgres (SQL function + sequence table, NOT client-side): format PNE-YYYY-NNNN, counter resets each Jan 1.
3. Upload all files to a PRIVATE Supabase Storage bucket "agreement-docs" under {token}/{role}-{docType}.ext. Store paths in files JSONB (never public URLs).
4. Insert/update the agreements row (status 'Docs Uploaded').
5. Call the sheet-sync (Task 3). On success set synced_to_sheets=true; on failure keep false and show a "Retry sync" button, never lose the DB record.
6. Show success screen with the token.
Note: the "Token No/Pwd/GRN/PRN" column in my sheet is the government GRN/PRN, which I enter later after payment. Store it in grn_details, separate from the internal token.

## TASK 3 - Save to Google Sheet in my existing layout
Use the existing google-sheets-script.js (Apps Script web app) or a service account via the Sheets API, whichever fits the repo better. Secrets only in env vars, called server-side. Each agreement is written as a 7-row block, appended at the bottom, with a header row in green:

Row 0 (green): A = serial number (running count), B = date, C = landlord name, D = witness 1 name, E = witness 2 name, F = GRN/PRN (blank for now, highlight yellow), G = date of receipt (blank), H = (blank), I = tenant 1 name, J = tenant 2 name, K = tenant 3 name, continuing for more tenants.
Row 1: A = monthly rent, B = property type (Flat/Room/Shop), C = landlord Aadhaar, E = witness 2 Aadhaar, D = witness 1 Aadhaar, I/J/K = tenant Aadhaar
Row 2: A = security deposit, B = flat/room/shop no, C = landlord PAN, I/J/K = tenant PAN
Row 3: A = tenure like "11M", B = area like "600sq.ft", C = landlord age like "42y", D/E = witness age, I/J/K = tenant age like "26y"
Row 4: I/J/K = tenant mobile (landlord mobile in C if available)
Row 5: blank
Row 6 (tall, wrap text): C = landlord address, D = witness 1 address, E = witness 2 address, H = full property address (Survey/Gat no, Building, Flat no, Floor, Village/Area), I/J/K = tenant addresses.
Format Aadhaar/PAN/mobile cells as plain text so Sheets does not convert them to scientific notation. Keep the first header row as in my sheet (match its column order exactly; read the header row first and map by header text, not hard-coded letters, so I can reorder later).
Also add an "Export .xlsx" button (exceljs, server-side) producing the same block layout for my local Excel file.

## TASK 4 - Security (mandatory)
- Remove the open "FOR ALL USING (true)" policy. All reads/writes of agreements and storage go through Next.js server routes using SUPABASE_SERVICE_ROLE_KEY (server only). Enable RLS with no anon policies on agreements and the storage bucket.
- Staff area (dashboard, case view, export, extension API) requires Supabase Auth login with an allow-listed staff email list.
- Public intake route may only create a case and upload its own files, rate-limited; it must not be able to read other cases.
- Never log full Aadhaar/PAN; mask in server logs (XXXX XXXX 1234). Add a .env.example listing all variables. Make sure no keys are committed.
- Add a Supabase migration file for all schema changes (token sequence, indexes, RLS).

## TASK 5 - Minimal staff dashboard
List of cases (token, landlord, tenants, status, synced flag), open a case to edit any field, "Re-sync to sheet", "Enter GRN/PRN" (saves to grn_details and updates the sheet's yellow GRN cell), and "Export IGR JSON".

FOLLOW-UP: replace TASK 6 of the previous prompt with the spec below, and apply the "data model additions" first. I have scanned the real IGR portal (https://efilingigr.maharashtra.gov.in/ereg, pages PropertyDetails.aspx and the Party Details page). It is ASP.NET WebForms.

## A. PARTY RULES ENFORCED IN INTAKE + SUBMIT
- Exactly 1 licensor/Owner (Landlord). At least 1 licencee/Tenant (no upper limit, "Party Number" increments 1..N: owner = 1, tenants = 2..N). Exactly 2 Identifiers (my "Witness 1/2"). Block Submit if these counts are wrong.
- Identifiers on the portal REQUIRE: surname, first name, age, road, location, pincode, village/city (PAN and contact optional). So in my UI make Aadhaar BACK required for both witnesses (or require the address fields to be typed manually).
- Owner and tenants REQUIRE: surname, first name, age, gender, salutation, PAN, road, location, pincode, village/city.

## B. DATA MODEL ADDITIONS (types/, schema migration, extraction, UI)
For every person (landlord, each tenant, each witness) store, in addition to what exists:
- name_en: {surname, first, middle}, name_mr: {surname, first, middle}
- salutation (Mr / Mrs / Miss; default from gender: Male->Mr, Female->Mrs, editable), gender (Male/Female/Others), age, pan, mobile, email (optional)
- address_en and address_mr, each: {building, flat_no, floor_no, road, location, pincode, village_city, district, state}
Name split rule (Maharashtrian convention, editable): "Sapna Yogesh Kakade" -> first = first word, surname = last word, middle = everything between. Keep the full-name field for the sheet.
Address split: use the Gemini extraction to split the Aadhaar address into road / location / village_city / district / state / pincode. Example: "Mithila, Upper Parijat, Vimannagar, Near Symbiosis College, Pune City" -> road "Mithila Upper Parijat", location "Near Symbiosis College", village_city "Vimannagar". Building/flat/floor stay empty unless clearly present. Show the split fields in an "IGR fields" collapsible section per person so staff can fix them.
MARATHI: Maharashtra Aadhaar cards usually print the name and address in Marathi too. Extract the Marathi text directly from the card when present; otherwise have Gemini transliterate (not translate) the English fields into Devanagari. Mark transliterated fields "Verify" in amber. Store everything editable.

Property additions (property_details JSONB): district (default Pune), taluka (default Haveli), village_igr (e.g. Vadgaon Sheri; dropdown value on portal), area_type (Urban/Rural, default Urban), local_limit_type (Corporation), local_limit_name (Pune), zp (empty), attribute1_type (default "Survey Number"), attribute1_number (my Survey/Gat/CTS No.), attribute2_type/number (optional), unit_type (Flat -> "Apartment/Flat"; read the dropdown options during scan for Room/Shop mapping), unit_area + unit_area_uom (default Square Feet), building_en/mr, flat_no_en/mr, floor_no_en/mr, road_en/mr, location_en/mr, use (Residential/Non-Residential), gallery_area + uom (default 0 Square Meter), parking_area + uom (default 0 Square Meter), police_station (dropdown text). Add these to the UI as one collapsible "IGR property fields" section with those defaults prefilled; do not alter the existing Step 1 layout. Also add "Area (sq.ft)" if it is not already captured (my sheet needs it).
The portal's "Property No." (a number plus a small dropdown) is not something I enter; ignore it.
The portal header shows "Token No: <GRN>" for the case being filled. The extension must read this and save it to the case's grn_details, and the sheet's GRN column.

## C. CHROME EXTENSION (Manifest V3) - WebForms-specific design
1. WebForms behaviors to handle:
   - Dropdowns with AutoPostBack reload part of or the whole page and replace DOM nodes. Always re-query elements after any change; never keep stale references.
   - Dependent chain on PropertyDetails: Taluka -> Village -> Local limit type -> Local limit name. Set one, WAIT for the postback to finish, then set the next. Detect completion by: hooking Sys.WebForms.PageRequestManager endRequest (inject a script into the page's MAIN world, use content_scripts "world": "MAIN" or chrome.scripting) with a MutationObserver + timeout fallback (10s).
   - If a postback is a FULL page reload, the content script restarts: persist the fill plan and progress in chrome.storage.session, and resume automatically after load.
   - Selects: match by option text (case-insensitive, trimmed), then by value; if no match, mark red and continue.
   - Respect maxlength (truncate and warn). Do not touch disabled fields (ZP is disabled for Urban). Marathi fields accept Devanagari via direct value set plus input/change events.
2. Resolve fields by LABEL TEXT first (portal ids look like ctl00_ContentPlaceHolder1_...). Layout is a table: label cell, then English input, then Marathi input in the same row. Provide optional "id" overrides in the map. Scan mode ("Scan this page") must dump label, id, name, type, options, disabled, maxlength for every control, and must also show whether a control has onchange/AutoPostBack, so I can paste output back to you.
3. Fill order and pages:
   PropertyDetails page: Taluka, Village, Property in Area (radio), Local limit type, Local limit name, Attribute 1 type + Number, Attribute 2 (if given), Type of Unit, Unit Area + unit, Building/Flat/Floor/Road/Location (English + Marathi), Use (radio), Gallery + unit, Parking + unit, Property Police Station. Skip District/Property No. if prefilled.
   Party Details page: first choose radio Party or Identifier. For Party: Party Number, Party Type ("licensor/Owner" for owner, "licencee/Tenant" for tenants), Party Entity Type = Individual, Surname/First/Middle (EN + MR), Age, Gender radio, Salutation, PAN, Contact, Email, Occupation (skip), Address block (Building, Flat, Floor, Road, Location, Pin Code, Village/City, District, State; English + Marathi), Executing = Self, and "Document Presentor" checkbox ONLY for the owner (it's disabled for tenants). For Identifier: Identifier Number (1 or 2), "For Which Party" = All Parties, then the same name/age/PAN/contact/address fields (no Occupation, no Document Presentor).
4. Workflow in the popup: after selecting a case it shows a checklist: Property (1), Owner (1), Tenant 1..N, Identifier 1..2 with status icons. Buttons: "Fill current page". For party pages, "Fill party #k" where I choose which one. Highlight filled fields green, unmatched/missing red, AI-unverified fields amber. Show a summary of what needs manual attention.
5. SAVING: the portal has "Add : Party Details", "Add : Identifier Details", "Update", "Next". These save draft entries, not the final submission. Default: the extension does NOT click them; I click. Provide an opt-in toggle (off by default) "Auto-click Add after filling this party" that clicks only the Add button once, waits for the postback, then offers "Fill next party". Never click anything that finalizes, pays, signs, or submits the application, and never touch captcha, OTP, login or eKYC.
6. Parties already saved on the portal: when the page shows an existing Party Number in the dropdown, do not overwrite it; ask me first.
7. Move all mappings to igr-field-map.json (property fields, party fields, address fields, option-text aliases such as Flat -> "Apartment/Flat"), so selectors and aliases can be fixed without code changes. Include a pre-fill version of that file built from the labels listed above.
8. Add a "Capture GRN" step: read the "Token No" from the header and send it to POST /api/cases/[token]/grn.

## D. SECURITY (reminder)
The extension must authenticate with a short-lived staff token; /api/cases/[token]/igr-export returns only the fields above. No full Aadhaar numbers are sent to the extension (portal does not need them on these pages). Never log PAN/Aadhaar. Fill data stays in chrome.storage.session and is cleared when done.
- Add a README section for loading the unpacked extension and updating the field map.

AMENDMENT TO PREVIOUS FOLLOW-UP: the IGR portal auto-generates the Marathi text when English is entered. Remove all Marathi handling from my app and fill only English fields.

## Remove
- name_mr, address_mr and all *_mr property fields from types, DB/migrations, UI, igr-export JSON and extraction.
- The Gemini transliteration / Devanagari extraction and the amber "Verify" Marathi badges. (Keep normal confidence badges for English fields.)
- The "MARATHI" paragraph in the data-model section and every "English + Marathi" instruction in the extension spec.

## Extension: fill English, let the portal produce Marathi
1. For every English text input that has a Marathi sibling (Surname, First Name, Middle Name, Building Name, Flat No, Floor No, Road, Location, Village/City, District, State and the property-address equivalents), simulate real typing:
   focus -> set value via the native setter -> dispatch keydown, input, keyup -> dispatch change -> blur.
   If the portal only triggers on blur or keyup, make sure that exact event fires. If it needs per-character typing, add a "typing mode" fallback (type char by char with ~15 ms delay), selectable per field in igr-field-map.json ("fillMode": "set" | "type").
2. Never write into the Marathi inputs. After blur, WAIT (poll up to 5 s, MutationObserver + interval) until the sibling Marathi input becomes non-empty. If the portal transliteration is an AJAX/postback call, wait for the request to finish before moving to the next field.
3. Verification: if the Marathi box is still empty after the timeout, mark that field red and add it to the "needs attention" list; do not retry endlessly (max 2 retries).
4. Show the generated Marathi text next to each filled field in the popup summary (read-only), so I can quickly spot bad transliterations. I will correct them manually on the portal. Do not overwrite portal-generated Marathi.
5. Do not clear a field before typing unless it already has text, in which case ask me before overwriting (some fields like Village/City or District/State may be prefilled by the portal; skip those when the value already matches).
6. In Scan mode, for every English input also report the id of its Marathi sibling input and which events it listens for (onblur, onkeyup, onchange attributes, if visible in the DOM), so I can paste back the results and we can set fillMode correctly per field.
7. Update igr-field-map.json accordingly: each text field entry has "english" selector/label, "marathiSibling" (read-only, used only for verification), and "fillMode".

## Acceptance
- No *_mr fields exist anywhere in the repo.
- After Fill, every Marathi sibling box is auto-populated by the portal; any that are empty are reported red.
- The extension never writes to a Marathi input.

## ACCEPTANCE
1. Submit blocks unless 1 owner, >=1 tenant, exactly 2 witnesses/identifiers with their required fields.
2. igr-export JSON contains EN + MR names and addresses for every party.
3. On the PropertyDetails page, "Fill current page" completes the Taluka -> Village -> Local limit chain correctly across postbacks.
4. On the Party page it fills owner, tenant N and identifier correctly, with the right radio/dropdown/checkbox behavior per party type.
5. Nothing final is submitted; "Auto-click Add" is off by default.


## Acceptance criteria
1. Choosing an Aadhaar/PAN image fills name, Aadhaar, PAN, age, address within a few seconds; fields stay editable.
2. Submit creates a PNE-YYYY-NNNN token, DB row, private files, and a new 7-row block in my sheet matching my layout.
3. Anon key alone cannot read any agreement or file.
4. Extension scan produces field JSON; fill works on at least the first portal step I test, and never submits anything.
5. Everything typed (npm run build passes), env documented, and a short TESTING.md with manual test steps.

Work in small commits, one per task, and show me the diff summary after each. Ask me before changing any existing UI component's layout.