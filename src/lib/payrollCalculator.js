// Kenyan statutory payroll deductions (2026 rates).
//
// These constants are kept separate and clearly labelled — not buried as
// magic numbers in the calculation logic — because Kenyan tax bands are
// revised periodically (there is active Finance Bill debate on these exact
// figures as of 2026). Anyone picking up this file later should be able to
// update just this block against KRA's current published rates.

const RATES = {
  NSSF_RATE: 0.06,            // 6% of pensionable pay
  NSSF_UPPER_LIMIT: 108000,   // contributions capped at this monthly pay
  SHIF_RATE: 0.0275,          // 2.75% of gross pay (replaced NHIF in 2024)
  AHL_RATE: 0.015,            // Affordable Housing Levy, 1.5% of gross pay
  PERSONAL_RELIEF: 2400,      // flat monthly relief subtracted from PAYE
  PAYE_BANDS: [
    { upTo: 24000, rate: 0.10 },
    { upTo: 32333, rate: 0.25 },
    { upTo: 500000, rate: 0.30 },
    { upTo: 800000, rate: 0.325 },
    { upTo: Infinity, rate: 0.35 },
  ],
};

function calculateNssf(gross) {
  const pensionablePay = Math.min(gross, RATES.NSSF_UPPER_LIMIT);
  return round2(pensionablePay * RATES.NSSF_RATE);
}

function calculateShif(gross) {
  return round2(gross * RATES.SHIF_RATE);
}

function calculateAhl(gross) {
  return round2(gross * RATES.AHL_RATE);
}

// PAYE is charged on what's left after NSSF, SHIF and AHL are deducted
// (these three are "allowable deductions" that reduce taxable pay), using
// Kenya's progressive band system, then reduced by the flat personal relief.
function calculatePaye(taxablePay) {
  let remaining = taxablePay;
  let previousCeiling = 0;
  let tax = 0;

  for (const band of RATES.PAYE_BANDS) {
    const bandWidth = band.upTo - previousCeiling;
    const taxableInBand = Math.min(Math.max(remaining, 0), bandWidth);
    tax += taxableInBand * band.rate;
    remaining -= taxableInBand;
    previousCeiling = band.upTo;
    if (remaining <= 0) break;
  }

  const payeAfterRelief = Math.max(tax - RATES.PERSONAL_RELIEF, 0);
  return round2(payeAfterRelief);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Computes a full, itemised payslip breakdown from gross pay alone.
 * Returns { gross, nssf, shif, ahl, paye, net }.
 */
function computePayslip(gross) {
  const grossNum = Number(gross) || 0;
  const nssf = calculateNssf(grossNum);
  const shif = calculateShif(grossNum);
  const ahl = calculateAhl(grossNum);
  const taxablePay = grossNum - nssf - shif - ahl;
  const paye = calculatePaye(taxablePay);
  const net = round2(grossNum - nssf - shif - ahl - paye);

  return { gross: grossNum, nssf, shif, ahl, paye, net };
}

export { computePayslip, RATES };
