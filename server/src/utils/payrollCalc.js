// Pure payroll maths for one worker for one week. Kept free of DB code so it is easy to test.
//
//   wages      = full days x day rate + half days x day rate / 2
//   overtime   = overtime hours x overtime rate
//   gross      = wages + overtime
//   deductions = advances this week + balance carried from last week
//   net pay    = gross - deductions (never below zero)
//   carry      = whatever deductions could not be recovered, moved to next week
//
// Rates come from the attendance records (snapshotted on the day), so a wage
// change in the middle of a week is paid correctly.

const round = (n) => Math.round(n * 100) / 100;

export function calculateLine({ attendance = [], advances = [], previousBalance = 0 }) {
  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let overtimeHours = 0;
  let wages = 0;
  let overtimePay = 0;

  for (const a of attendance) {
    if (a.status === 'present') {
      presentDays += 1;
      wages += a.dailyWage;
    } else if (a.status === 'half_day') {
      halfDays += 1;
      wages += a.dailyWage / 2;
    } else {
      absentDays += 1;
    }
    if (a.status !== 'absent' && a.overtimeHours > 0) {
      overtimeHours += a.overtimeHours;
      overtimePay += a.overtimeHours * a.overtimeRate;
    }
  }

  const advanceTotal = advances.reduce((sum, a) => sum + a.amount, 0);
  const gross = wages + overtimePay;
  const deductions = advanceTotal + previousBalance;
  const netPay = Math.max(0, gross - deductions);
  const carryForward = Math.max(0, deductions - gross);

  return {
    presentDays,
    halfDays,
    absentDays,
    overtimeHours: round(overtimeHours),
    wages: round(wages),
    overtimePay: round(overtimePay),
    gross: round(gross),
    advances: round(advanceTotal),
    previousBalance: round(previousBalance),
    deductions: round(deductions),
    netPay: round(netPay),
    carryForward: round(carryForward),
  };
}
