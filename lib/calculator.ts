export function calculateTotalAgreementFee(monthlyRent: number, deposit: number, months: number = 11): {
  stampDuty: number;
  fixedFees: number;
  totalAmount: number;
} {
  const rent = Number(monthlyRent) || 0;
  const dep = Number(deposit) || 0;
  const m = Number(months) || 11;

  const totalRent = rent * m;
  const years = m / 12;
  const notionalInterest = 0.10 * dep * years;
  const totalConsideration = totalRent + notionalInterest;
  const rawStampDuty = totalConsideration * 0.0025;

  // Round stamp duty to nearest rupee
  const stampDuty = Math.ceil(rawStampDuty);

  // Fixed Fees: Registration (1000) + DHC (300) + Service Charges (1200) = 2500
  const fixedFees = 1000 + 300 + 1200;
  const totalAmount = Math.ceil(stampDuty + fixedFees);

  return {
    stampDuty,
    fixedFees,
    totalAmount,
  };
}
