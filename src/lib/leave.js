const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value) {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function countLeaveWorkingDays(startDate, endDate) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || start > end) return 0;

  let workingDays = 0;
  const date = new Date(start);
  while (date <= end) {
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) workingDays += 1;
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return workingDays;
}

export { countLeaveWorkingDays };
