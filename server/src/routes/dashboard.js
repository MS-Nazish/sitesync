import { Router } from 'express';
import Site from '../models/Site.js';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import Advance from '../models/Advance.js';
import Payroll from '../models/Payroll.js';
import { protect, isAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { addDays, daysBetween, todayString, weekRange } from '../utils/dates.js';
import { calculateLine } from '../utils/payrollCalc.js';

const router = Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const today = todayString();
    const sites = await Site.find(
      isAdmin(req) ? { status: 'active' } : { _id: { $in: req.user.assignedSites }, status: 'active' }
    ).lean();
    const siteIds = sites.map((s) => s._id);
    const inSites = { site: { $in: siteIds } };

    const trendFrom = addDays(today, -13);
    const [workerCounts, todayRecords, trendRaw, pendingPayrolls, flagged, pendingAdv, recentAdvances] =
      await Promise.all([
        Worker.aggregate([
          { $match: { ...inSites, active: true } },
          { $group: { _id: '$site', count: { $sum: 1 } } },
        ]),
        Attendance.find({ ...inSites, date: today }).lean(),
        Attendance.aggregate([
          { $match: { ...inSites, date: { $gte: trendFrom, $lte: today } } },
          { $group: { _id: { date: '$date', status: '$status' }, count: { $sum: 1 } } },
        ]),
        Payroll.find({ ...inSites, status: { $in: ['draft', 'approved'] } }, { lines: 0 })
          .populate('site', 'name')
          .sort({ weekStart: -1 })
          .limit(6),
        Attendance.find({ ...inSites, outsideGeofence: true, date: { $gte: addDays(today, -6) } })
          .populate('worker', 'name')
          .populate('site', 'name')
          .sort({ date: -1, createdAt: -1 })
          .limit(5),
        Advance.aggregate([
          { $match: { ...inSites, payroll: null } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Advance.find(inSites).populate('worker', 'name').sort({ createdAt: -1 }).limit(5),
      ]);

    const workersBySite = new Map(workerCounts.map((w) => [w._id.toString(), w.count]));
    const activeWorkers = workerCounts.reduce((s, w) => s + w.count, 0);

    const countStatus = (records) => ({
      present: records.filter((r) => r.status === 'present').length,
      halfDay: records.filter((r) => r.status === 'half_day').length,
      absent: records.filter((r) => r.status === 'absent').length,
    });

    // Running wage bill for the current payroll week of every site
    let weekWages = 0;
    let weekAdvances = 0;
    const perSite = await Promise.all(
      sites.map(async (site) => {
        const { start, end } = weekRange(today, site.weekStartDay);
        const [weekAttendance, weekAdv] = await Promise.all([
          Attendance.find({ site: site._id, date: { $gte: start, $lte: end } }).lean(),
          Advance.find({ site: site._id, date: { $gte: start, $lte: end } }).lean(),
        ]);
        const calc = calculateLine({ attendance: weekAttendance, advances: weekAdv });
        weekWages += calc.gross;
        weekAdvances += calc.advances;

        const siteToday = todayRecords.filter((r) => r.site.equals(site._id));
        const workers = workersBySite.get(site._id.toString()) || 0;
        return {
          _id: site._id,
          name: site.name,
          workers,
          marked: siteToday.length,
          ...countStatus(siteToday),
          flagged: siteToday.filter((r) => r.outsideGeofence).length,
          weekStart: start,
          weekEnd: end,
          weekWages: calc.gross,
        };
      })
    );

    const trendMap = new Map();
    trendRaw.forEach(({ _id, count }) => {
      const day = trendMap.get(_id.date) || { present: 0, half_day: 0, absent: 0 };
      day[_id.status] = count;
      trendMap.set(_id.date, day);
    });
    const trend = daysBetween(trendFrom, today).map((date) => {
      const d = trendMap.get(date) || { present: 0, half_day: 0, absent: 0 };
      return { date, present: d.present, halfDay: d.half_day, absent: d.absent };
    });

    res.json({
      today,
      totals: {
        activeSites: sites.length,
        activeWorkers,
        ...countStatus(todayRecords),
        notMarked: perSite.reduce((s, p) => s + Math.max(0, p.workers - p.marked), 0),
        flaggedToday: todayRecords.filter((r) => r.outsideGeofence).length,
        weekWages: Math.round(weekWages),
        weekAdvances: Math.round(weekAdvances),
        pendingAdvances: pendingAdv[0]?.total || 0,
      },
      perSite,
      trend,
      pendingPayrolls,
      flagged,
      recentAdvances,
    });
  })
);

export default router;
