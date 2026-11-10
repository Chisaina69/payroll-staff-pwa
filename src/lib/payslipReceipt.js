import { computePayslip } from "./payrollCalculator.js";

function getPayslipDetails(record) {
  const basicPay = Number(record.basic_pay) || 0;
  const allowances = Number(record.allowances) || 0;
  const gross = basicPay + allowances;
  const breakdown = computePayslip(gross);
  const deductionTotal = Number(record.deductions) || 0;
  const calculatedTotal = breakdown.nssf + breakdown.shif + breakdown.ahl + breakdown.paye;
  const otherAdjustments = Math.round((deductionTotal - calculatedTotal) * 100) / 100;
  const storedNetPay = Number(record.net_pay);
  const netPay = record.net_pay !== null &&
      record.net_pay !== undefined &&
      Number.isFinite(storedNetPay)
    ? storedNetPay
    : gross - deductionTotal;

  return {
    basicPay,
    allowances,
    gross,
    deductionTotal,
    netPay,
    deductions: [
      { label: "NSSF pension contribution", amount: breakdown.nssf },
      { label: "SHIF contribution", amount: breakdown.shif },
      { label: "Affordable Housing Levy", amount: breakdown.ahl },
      { label: "PAYE income tax", amount: breakdown.paye },
      ...(Math.abs(otherAdjustments) >= 0.01
        ? [{ label: "Other payroll adjustments", amount: otherAdjustments }]
        : []),
    ],
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatCurrency(amount) {
  return `KES ${Number(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function openPayslipReceipt(record, employee) {
  const receiptWindow = window.open("", "_blank");
  if (!receiptWindow) return false;

  const details = getPayslipDetails(record);
  const employeeName = employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : "Employee";
  const deductions = details.deductions.map(({ label, amount }) => `
    <tr><td>${escapeHtml(label)}</td><td class="amount">${escapeHtml(formatCurrency(amount))}</td></tr>
  `).join("");
  const title = `Payslip ${record.pay_period_start || ""}`;

  receiptWindow.document.open();
  receiptWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)}</title>
        <style>
          :root { color-scheme: light; font-family: Arial, sans-serif; color: #172033; }
          body { max-width: 760px; margin: 32px auto; padding: 24px; }
          header { border-bottom: 2px solid #244e78; padding-bottom: 16px; margin-bottom: 24px; }
          h1 { margin: 0 0 8px; color: #244e78; }
          p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 11px 8px; border-bottom: 1px solid #d8dee8; text-align: left; }
          th { background: #f3f6fa; }
          .amount { text-align: right; white-space: nowrap; }
          .total { font-weight: bold; }
          .net { font-size: 1.15rem; color: #176b48; }
          .actions { margin: 24px 0; }
          button { padding: 10px 18px; border: 0; border-radius: 6px; background: #244e78; color: white; font-size: 1rem; cursor: pointer; }
          @media print {
            body { margin: 0 auto; padding: 0; }
            .actions { display: none; }
          }
        </style>
      </head>
      <body>
        <header>
          <h1>PAYSLIP</h1>
          <p>Pay period: ${escapeHtml(record.pay_period_start)} – ${escapeHtml(record.pay_period_end)}</p>
          <p>Payment status: ${escapeHtml(record.payment_status)}</p>
        </header>
        <p><strong>Employee:</strong> ${escapeHtml(employeeName)}</p>
        <p><strong>Employee ID:</strong> ${escapeHtml(employee?.employee_code || "")}</p>
        <table>
          <tbody>
            <tr><td>Basic pay</td><td class="amount">${escapeHtml(formatCurrency(details.basicPay))}</td></tr>
            <tr><td>Allowances</td><td class="amount">${escapeHtml(formatCurrency(details.allowances))}</td></tr>
            <tr class="total"><td>Gross pay</td><td class="amount">${escapeHtml(formatCurrency(details.gross))}</td></tr>
          </tbody>
        </table>
        <h2>Deductions</h2>
        <table>
          <thead><tr><th>Deduction</th><th class="amount">Amount</th></tr></thead>
          <tbody>
            ${deductions}
            <tr class="total"><td>Total deductions</td><td class="amount">${escapeHtml(formatCurrency(details.deductionTotal))}</td></tr>
          </tbody>
        </table>
        <p class="net"><strong>Net pay:</strong> ${escapeHtml(formatCurrency(details.netPay))}</p>
        <div class="actions"><button onclick="window.print()">Download / Print PDF</button></div>
      </body>
    </html>`);
  receiptWindow.document.close();
  receiptWindow.opener = null;
  receiptWindow.setTimeout(() => receiptWindow.print(), 250);
  return true;
}

export { formatCurrency, getPayslipDetails, openPayslipReceipt };
