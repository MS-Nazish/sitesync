import { Router } from 'express';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import Advance from '../models/Advance.js';
import Payroll from '../models/Payroll.js';
import { protect, authorize, siteScope, assertSiteAccess } from '../middleware/auth.js';
import { imageUpload, publicPath } from '../middleware/upload.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router = Router();
router.use(protect);

const upload = imageUpload('workers');
const FIELDS = ['name', 'fatherName', 'phone', 'cnic', 'skill', 'dailyWage', 'overtimeRate', 'site', 'joinedAt', 'active'];

// Multipart forms send everything as strings; empty strings mean "clear this field"
function pick(body) {
  const data = {};
  for (const key of FIELDS) {
    if (body[key] === undefined) continue;
    data[key] = body[key] === '' ? null : body[key];
  }
  if (data.active !== undefined) data.active = data.active === true || data.active === 'true';
  return data;
}

async function loadWorker(req) {
  const worker = await Worker.findById(req.params.id).populate('site', 'name');
  if (!worker) throw new HttpError(404, 'Worker not found');
  assertSiteAccess(req, worker.site._id);
  return worker;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = siteScope(req);
    if (req.query.site) {
      assertSiteAccess(req, req.query.site);
      filter.site = req.query.site;
    }
    if (req.query.active !== 'all') filter.active = req.query.active !== 'false';
    if (req.query.skill) filter.skill = req.query.skill;
    if (req.query.search) {
      const rx = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { cnic: rx }];
    }
    const workers = await Worker.find(filter).populate('site', 'name').sort({ name: 1 });
    res.json(workers);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const worker = await loadWorker(req);
    const [daysWorked, pendingAdvances, payrolls] = await Promise.all([
      Attendance.aggregate([
        { $match: { worker: worker._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Advance.aggregate([
        { $match: { worker: worker._id, payroll: null } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payroll.find({ 'lines.worker': worker._id }, { site: 1, weekStart: 1, weekEnd: 1, status: 1, 'lines.$': 1 })
        .populate('site', 'name')
        .sort({ weekStart: -1 })
        .limit(12),
    ]);

    const byStatus = Object.fromEntries(daysWorked.map((d) => [d._id, d.count]));
    res.json({
      worker,
      stats: {
        present: byStatus.present || 0,
        halfDay: byStatus.half_day || 0,
        absent: byStatus.absent || 0,
        pendingAdvances: pendingAdvances[0]?.total || 0,
        totalPaid: payrolls.filter((p) => p.status === 'paid').reduce((s, p) => s + p.lines[0].netPay, 0),
      },
      payrolls: payrolls.map((p) => ({
        _id: p._id,
        site: p.site,
        weekStart: p.weekStart,
        weekEnd: p.weekEnd,
        status: p.status,
        line: p.lines[0],
      })),
    });
  })
);

// Attendance for one month, for the worker's calendar: ?month=YYYY-MM
router.get(
  '/:id/attendance',
  asyncHandler(async (req, res) => {
    const worker = await loadWorker(req);
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
    const records = await Attendance.find({ worker: worker._id, date: { $regex: `^${month}` } })
      .populate('site', 'name')
      .sort({ date: 1 });
    res.json({ month, records });
  })
);

router.post(
  '/',
  authorize('admin', 'supervisor'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const data = pick(req.body);
    assertSiteAccess(req, data.site);
    data.photo = publicPath('workers', req.file);
    const worker = await Worker.create(data);
    await worker.populate('site', 'name');
    res.status(201).json(worker);
  })
);

router.put(
  '/:id',
  authorize('admin', 'supervisor'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const worker = await loadWorker(req);
    const data = pick(req.body);
    if (data.site) assertSiteAccess(req, data.site);
    if (req.file) data.photo = publicPath('workers', req.file);
    worker.set(data);
    await worker.save();
    await worker.populate('site', 'name');
    res.json(worker);
  })
);

// Workers are never hard-deleted because payroll history points at them
router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const worker = await loadWorker(req);
    worker.active = false;
    await worker.save();
    res.json({ message: 'Worker deactivated' });
  })
);

export default router;
