# Pune Rent Agreement Automation System

A production-ready full-stack automation system for rent agreement registration agencies in Pune, Maharashtra. It automates client intake, parses official documents with Gemini AI, generates sequential atomic tokens, syncs 7-row agreement blocks to Google Sheets, exports formatted `.xlsx` files, and autofills Maharashtra IGR e-registration portal WebForms.

---

## Architecture Overview

- **Frontend & Wizards**: Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide Icons.
- **AI Document Extraction**: Google Gemini Vision (`@google/generative-ai`) and Groq Vision AI (`qwen/qwen3.8-27b`) fallback via `/api/extract` with client-side canvas image compression (max 1600px, JPEG 0.8), regex validation, age computation, and Aadhaar front/back merging.
- **Database & Security**: Supabase PostgreSQL with locked-down Row Level Security (RLS), atomic sequence function `generate_next_token(year)`, private bucket `agreement-docs`, and masked Aadhaar/PAN logs.
- **Google Sheets Integration**: 7-row block layout matching agency ledger format with green header row, yellow GRN cell, dynamic header mapping, and ExcelJS buffer export.
- **Chrome Extension (Manifest V3)**: Resilient ASP.NET WebForms autofill with `Sys.WebForms.PageRequestManager` hook, typing simulation, Marathi sibling auto-transliteration verification, scan mode, and GRN header capture.

---

## Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key (bypasses RLS for secure operations) |
| `GEMINI_API_KEY` | Google Gemini API key for document extraction |
| `GEMINI_MODEL` | Model name (e.g. `gemini-1.5-flash` or `gemini-2.0-flash`) |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Apps Script Web App URL from `google-sheets-script.js` |
| `ALLOWED_STAFF_EMAILS` | Comma-separated list of allow-listed staff email addresses |
| `STAFF_API_SECRET` | Secret token for Chrome Extension and internal API authorization |

---

## Database Migration

Run `schema_migration.sql` in your Supabase SQL Editor:
1. Creates the `token_sequences` table and atomic `generate_next_token(p_year)` function.
2. Creates the `staff_users` table for allow-listed staff.
3. Locks down RLS on `agreements` and `storage.objects` (removes public anon access).
4. Creates the private storage bucket `agreement-docs` (20 MB limit).
5. Adds performance indexes on tokens, mobile, and status.

---

## Chrome Extension Setup (Manifest V3)

### 1. Load Unpacked Extension
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top-right toggle.
3. Click **Load unpacked**.
4. Select the `chrome-extension/` directory from this repository.
5. The extension "Pune Rent Agreement IGR Maharashtra Auto-Filler" will appear in your extensions list.

### 2. Updating Field Selectors (`igr-field-map.json`)
The extension reads all portal mappings dynamically from `chrome-extension/igr-field-map.json`:
- **Scan Mode**: Click "Scan This Page" inside the extension popup while on an IGR portal page. It dumps control IDs, labels, types, and event listeners directly to your clipboard.
- **Aliases**: To add or customize dropdown options (e.g., mapping "Room" to another portal text), update `optionAliases` in `igr-field-map.json`.
- **Typing Simulation**: Text inputs specify `"fillMode": "type"` (char-by-char with 15ms delay) or `"fillMode": "set"`. The extension never writes into Marathi boxes; it lets the portal auto-populate them after blur and verifies their content.

---

## Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run production build validation
npm run build
```

Open [http://localhost:3000](http://localhost:3000) for client intake, or [http://localhost:3000/admin](http://localhost:3000/admin) for the staff dashboard.
