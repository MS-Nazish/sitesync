import Attendance from '../models/Attendance.js';
import Advance from '../models/Advance.js';
import Worker from '../models/Worker.js';
import Payroll from '../models/Payroll.js';
import { calculateLine } from '../utils/payrollCalc.js';

// Balance a worker still owes (advances not yet recovered) from their last approved payroll before this week
async function previousBalance(workerId, weekStart, excludeId) {
  const last = await Payroll.findOne(
    {
      'lines.worker': workerId,
      status: { $in: ['approved', 'paid'] },
      weekStart: { $lt: weekStart },
      ...(excludeId && { _id: { $ne: excludeId } }),
    },
    { 'lines.$': 1 }
  )
    .sort({ weekStart: -1 })
    .lean();
  return last?.lines?.[0]?.carryForward || 0;
}

// Builds the payroll lines for one site for one week from attendance + advances
export async function buildPayrollLines(siteId, weekStart, weekEnd, excludeId) {
  const range = { $gte: weekStart, $lte: weekEnd };
  const [attendance, advances] = await Promise.all([
    Attendance.find({ site: siteId, date: range }).lean(),
    Advance.find({ site: siteId, date: range }).lean(),
  ]);

  const byWorker = new Map();
  const bucket = (id) => {
    const key = id.toString();
    if (!byWorker.has(key)) byWorker.set(key, { attendance: [], advances: [] });
    return byWorker.get(key);
  };
  attendance.forEach((a) => bucket(a.worker).attendance.push(a));
  advances.forEach((a) => bucket(a.worker).advances.push(a));

  const workers = await Worker.find({ _id: { $in: [...byWorker.keys()] } }).lean();

  const lines = await Promise.all(
    workers.map(async (w) => {
      const data = byWorker.get(w._id.toString());
      const prev = await previousBalance(w._id, weekStart, excludeId);
      return {
        worker: w._id,
        workerName: w.name,
        skill: w.skill,
        dailyWage: w.dailyWage,
        ...calculateLine({ attendance: data.attendance, advances: data.advances, previousBalance: prev }),
      };
    })
  );
  lines.sort((a, b) => a.workerName.localeCompare(b.workerName));

  const sum = (key) => Math.round(lines.reduce((s, l) => s + l[key], 0) * 100) / 100;
  const totals = {
    workers: lines.length,
    gross: sum('gross'),
    advances: sum('advances'),
    deductions: sum('deductions'),
    netPay: sum('netPay'),
  };
  return { lines, totals };
}

// True when an approved or paid payroll already covers this site + date (records are then frozen)
export async function isWeekLocked(siteId, date) {
  const locked = await Payroll.exists({
    site: siteId,
    weekStart: { $lte: date },
    weekEnd: { $gte: date },
    status: { $in: ['approved', 'paid'] },
  });
  return Boolean(locked);
}
