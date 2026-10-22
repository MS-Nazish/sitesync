import { Router } from 'express';
import Attendance, { ATTENDANCE_STATUS } from '../models/Attendance.js';
import Worker from '../models/Worker.js';
import Site from '../models/Site.js';
import { protect, authorize, isAdmin, siteScope, assertSiteAccess } from '../middleware/auth.js';
import { imageUpload, publicPath } from '../middleware/upload.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { addDays, isDateString, todayString } from '../utils/dates.js';
import { distanceInMeters, isValidCoord } from '../utils/geo.js';
import { isWeekLocked } from '../services/payroll.js';

const router = Router();
router.use(protect);

const upload = imageUpload('attendance');
const lockHours = () => Number(process.env.ATTENDANCE_LOCK_HOURS || 24);

// Attendance sheet for one site and day: every active worker plus their record if already marked
router.get(
  '/sheet',
  asyncHandler(async (req, res) => {
    const { site: siteId } = req.query;
    const date = req.query.date || todayString();
    assertSiteAccess(req, siteId);
    if (!isDateString(date)) throw new HttpError(400, 'Invalid date');

    const site = await Site.findById(siteId);
    if (!site) throw new HttpError(404, 'Site not found');

    const records = await Attendance.find({ site: siteId, date }).populate('markedBy', 'name');
    const recordIds = records.map((r) => r.worker);
    const workers = await Worker.find({
      $or: [{ site: siteId, active: true }, { _id: { $in: recordIds } }],
    }).sort({ name: 1 });

    const byWorker = new Map(records.map((r) => [r.worker.toString(), r]));
    const cutoff = Date.now() - lockHours() * 3600 * 1000;
    const payrollLocked = await isWeekLocked(siteId, date);

    res.json({
      site,
      date,
      payrollLocked,
      rows: workers.map((w) => {
        const record = byWorker.get(w._id.toString()) || null;
        const editable =
          !payrollLocked && (isAdmin(req) || !record || record.createdAt.getTime() > cutoff);
        return { worker: w, record, editable };
      }),
    });
  })
);

// Save attendance for many workers at once.
// multipart/form-data: site, date, entries (JSON array), lat, lng, accuracy, photo (optional image)
router.post(
  '/',
  authorize('admin', 'supervisor'),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const { site: siteId } = req.body;
    const date = req.body.date || todayString();
    assertSiteAccess(req, siteId);
    if (!isDateString(date)) throw new HttpError(400, 'Invalid date');
    if (date > todayString()) throw new HttpError(400, 'Attendance cannot be marked for a future date');

    // Attendance saved on a phone without internet is uploaded later, so it may arrive a day or two late
    const offline = req.body.offline === true || req.body.offline === 'true';
    const capturedAt = offline && req.body.capturedAt ? new Date(req.body.capturedAt) : undefined;
    if (capturedAt && (Number.isNaN(capturedAt.getTime()) || capturedAt.getTime() > Date.now() + 5 * 60 * 1000)) {
      throw new HttpError(400, 'Invalid capture time');
    }
    if (!isAdmin(req) && date !== todayString()) {
      const syncDays = Number(process.env.OFFLINE_SYNC_DAYS || 3);
      const lateSyncAllowed = offline && capturedAt && date >= addDays(todayString(), -syncDays);
      if (!lateSyncAllowed) throw new HttpError(403, 'Supervisors can only mark attendance for today');
    }
    if (await isWeekLocked(siteId, date)) {
      throw new HttpError(409, 'Payroll for this week is already approved, so attendance is locked');
    }

    const site = await Site.findById(siteId);
    if (!site) throw new HttpError(404, 'Site not found');

    let entries;
    try {
      entries = typeof req.body.entries === 'string' ? JSON.parse(req.body.entries) : req.body.entries;
    } catch {
      throw new HttpError(400, 'entries must be valid JSON');
    }
    if (!Array.isArray(entries) || entries.length === 0) throw new HttpError(400, 'No attendance entries sent');

    // GPS proof: compare the phone's position with the site centre
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const gps = isValidCoord(lat, lng) ? { lat, lng, accuracy: Number(req.body.accuracy) || undefined } : undefined;
    let distanceFromSite;
    let outsideGeofence = false;
    if (gps && site.location?.lat != null && site.location?.lng != null) {
      distanceFromSite = distanceInMeters(gps, site.location);
      outsideGeofence = distanceFromSite > site.radiusMeters;
    }
    const photo = publicPath('attendance', req.file);

    const workers = await Worker.find({ _id: { $in: entries.map((e) => e.worker) } });
    const workerMap = new Map(workers.map((w) => [w._id.toString(), w]));
    const existing = await Attendance.find({ worker: { $in: workers.map((w) => w._id) }, date });
    const existingMap = new Map(existing.map((r) => [r.worker.toString(), r]));
    const cutoff = Date.now() - lockHours() * 3600 * 1000;

    const saved = [];
    const skipped = [];

    for (const entry of entries) {
      const worker = workerMap.get(String(entry.worker));
      const record = existingMap.get(String(entry.worker));
      const name = worker?.name || entry.worker;

      if (!worker) {
        skipped.push({ worker: entry.worker, reason: 'Worker not found' });
        continue;
      }
      if (!ATTENDANCE_STATUS.includes(entry.status)) {
        skipped.push({ worker: name, reason: 'Invalid status' });
        continue;
      }
      if (record && !record.site.equals(site._id)) {
        skipped.push({ worker: name, reason: 'Already marked at another site today' });
        continue;
      }
      if (!record && !worker.site.equals(site._id)) {
        skipped.push({ worker: name, reason: 'Worker is not assigned to this site' });
        continue;
      }
      if (record && !isAdmin(req) && record.createdAt.getTime() < cutoff) {
        skipped.push({ worker: name, reason: `Locked after ${lockHours()} hours — ask the admin` });
        continue;
      }

      const overtimeHours = entry.status === 'absent' ? 0 : Math.max(0, Math.min(16, Number(entry.overtimeHours) || 0));
      const doc = record || new Attendance({ worker: worker._id, site: site._id, date });
      doc.set({
        status: entry.status,
        overtimeHours,
        note: entry.note || undefined,
        markedBy: req.user._id,
        // Rate snapshot: on edit keep the rate from the day, unless it was never set
        dailyWage: record?.dailyWage ?? worker.dailyWage,
        overtimeRate: record?.overtimeRate ?? worker.effectiveOvertimeRate,
      });
      if (gps) doc.set({ gps, distanceFromSite, outsideGeofence });
      if (photo) doc.photo = photo;
      doc.set({ offline, capturedAt });
      await doc.save();
      saved.push(doc._id);
    }

    res.status(201).json({
      saved: saved.length,
      skipped,
      distanceFromSite,
      outsideGeofence,
      gpsCaptured: Boolean(gps),
    });
  })
);

// Attendance log with filters: ?site=&worker=&from=&to=&flagged=true
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = siteScope(req);
    if (req.query.site) {
      assertSiteAccess(req, req.query.site);
      filter.site = req.query.site;
    }
    if (req.query.worker) filter.worker = req.query.worker;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (isDateString(req.query.from)) filter.date.$gte = req.query.from;
      if (isDateString(req.query.to)) filter.date.$lte = req.query.to;
    }
    if (req.query.flagged === 'true') filter.outsideGeofence = true;

    const records = await Attendance.find(filter)
      .populate('worker', 'name skill')
      .populate('site', 'name')
      .populate('markedBy', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(500);
    res.json(records);
  })
);

router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const record = await Attendance.findById(req.params.id);
    if (!record) throw new HttpError(404, 'Record not found');
    if (await isWeekLocked(record.site, record.date)) {
      throw new HttpError(409, 'Payroll for this week is approved; reopen it first');
    }
    await record.deleteOne();
    res.json({ message: 'Attendance record deleted' });
  })
);

export default router;
