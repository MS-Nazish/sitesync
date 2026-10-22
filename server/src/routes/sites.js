import { Router } from 'express';
import Site from '../models/Site.js';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import { protect, authorize, isAdmin, assertSiteAccess } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router = Router();
router.use(protect);

const FIELDS = ['name', 'address', 'clientName', 'location', 'radiusMeters', 'weekStartDay', 'status', 'startDate'];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = isAdmin(req) ? {} : { _id: { $in: req.user.assignedSites } };
    if (req.query.status) filter.status = req.query.status;
    const sites = await Site.find(filter).sort({ status: 1, name: 1 }).lean();

    const counts = await Worker.aggregate([
      { $match: { active: true, site: { $in: sites.map((s) => s._id) } } },
      { $group: { _id: '$site', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
    res.json(sites.map((s) => ({ ...s, workerCount: countMap.get(s._id.toString()) || 0 })));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    assertSiteAccess(req, req.params.id);
    const site = await Site.findById(req.params.id);
    if (!site) throw new HttpError(404, 'Site not found');
    res.json(site);
  })
);

router.post(
  '/',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const site = await Site.create({ ...pick(req.body), createdBy: req.user._id });
    res.status(201).json(site);
  })
);

router.put(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const site = await Site.findByIdAndUpdate(req.params.id, pick(req.body), { new: true, runValidators: true });
    if (!site) throw new HttpError(404, 'Site not found');
    res.json(site);
  })
);

router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const [workers, records] = await Promise.all([
      Worker.countDocuments({ site: req.params.id }),
      Attendance.countDocuments({ site: req.params.id }),
    ]);
    if (workers || records) {
      throw new HttpError(409, 'This site has workers or attendance history. Mark it "completed" instead of deleting.');
    }
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) throw new HttpError(404, 'Site not found');
    res.json({ message: 'Site deleted' });
  })
);

export default router;
