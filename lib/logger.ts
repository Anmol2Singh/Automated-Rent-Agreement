/**
 * Logging utility that strictly masks Indian identity numbers (Aadhaar, PAN)
 * Example:
 * 123456789012 -> "XXXX XXXX 9012"
 * ABCDE1234F -> "ABXXXX34F"
 */
export function maskSensitive(text?: string): string {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, '');
  if (/^\d{12}$/.test(clean)) {
    return `XXXX XXXX ${clean.slice(-4)}`;
  }
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(clean)) {
    return `${clean.slice(0, 2)}XXXX${clean.slice(-3)}`;
  }
  return text;
}

export function safeLogAgreement(action: string, tokenNumber: string, landlordName?: string, aadhaar?: string) {
  console.log(
    `[AGREEMENT] ${action} | Token: ${tokenNumber} | Landlord: ${landlordName || 'N/A'} | Aadhaar: ${maskSensitive(aadhaar)}`
  );
}
