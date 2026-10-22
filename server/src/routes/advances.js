import { Router } from 'express';
import Advance from '../models/Advance.js';
import Worker from '../models/Worker.js';
import { protect, authorize, isAdmin, siteScope, assertSiteAccess } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { isDateString, todayString } from '../utils/dates.js';
import { isWeekLocked } from '../services/payroll.js';

const router = Router();
router.use(protect);

// ?site=&worker=&from=&to=&status=pending|settled
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = siteScope(req);
    if (req.query.site) {
      assertSiteAccess(req, req.query.site);
      filter.site = req.query.site;
    }
    if (req.query.worker) filter.worker = req.query.worker;
    if (req.query.status === 'pending') filter.payroll = null;
    if (req.query.status === 'settled') filter.payroll = { $ne: null };
    if (isDateString(req.query.from) || isDateString(req.query.to)) {
      filter.date = {};
      if (isDateString(req.query.from)) filter.date.$gte = req.query.from;
      if (isDateString(req.query.to)) filter.date.$lte = req.query.to;
    }

    const advances = await Advance.find(filter)
      .populate('worker', 'name skill')
      .populate('site', 'name')
      .populate('givenBy', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(500);
    res.json(advances);
  })
);

router.post(
  '/',
  authorize('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const { worker: workerId, note } = req.body;
    const amount = Number(req.body.amount);
    const date = req.body.date || todayString();

    const worker = await Worker.findById(workerId);
    if (!worker) throw new HttpError(404, 'Worker not found');
    assertSiteAccess(req, worker.site);
    if (!isDateString(date) || date > todayString()) throw new HttpError(400, 'Invalid date');
    if (!(amount > 0)) throw new HttpError(400, 'Amount must be greater than zero');
    if (await isWeekLocked(worker.site, date)) {
      throw new HttpError(409, 'Payroll for that week is already approved; use a date in the current week');
    }

    const advance = await Advance.create({
      worker: worker._id,
      site: worker.site,
      amount,
      date,
      note,
      givenBy: req.user._id,
    });
    await advance.populate([
      { path: 'worker', select: 'name skill' },
      { path: 'site', select: 'name' },
      { path: 'givenBy', select: 'name' },
    ]);
    res.status(201).json(advance);
  })
);

router.delete(
  '/:id',
  authorize('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const advance = await Advance.findById(req.params.id);
    if (!advance) throw new HttpError(404, 'Advance not found');
    assertSiteAccess(req, advance.site);
    if (advance.payroll) throw new HttpError(409, 'This advance was already deducted in an approved payroll');
    if (!isAdmin(req) && !advance.givenBy.equals(req.user._id)) {
      throw new HttpError(403, 'Only the person who recorded this advance or an admin can delete it');
    }
    await advance.deleteOne();
    res.json({ message: 'Advance deleted' });
  })
);

export default router;
