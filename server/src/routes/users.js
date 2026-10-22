import { Router } from 'express';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

// Admin-only management of supervisor / admin accounts
const router = Router();
router.use(protect, authorize('admin'));

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await User.find().populate('assignedSites', 'name').sort({ role: 1, name: 1 });
    res.json(users);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, phone, password, role, assignedSites } = req.body;
    const user = await User.create({ name, email, phone, password, role, assignedSites });
    await user.populate('assignedSites', 'name');
    res.status(201).json(user);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('+password');
    if (!user) throw new HttpError(404, 'User not found');

    const isSelf = user._id.equals(req.user._id);
    if (isSelf && (req.body.role === 'supervisor' || req.body.active === false)) {
      throw new HttpError(400, 'You cannot demote or disable your own account');
    }

    for (const key of ['name', 'email', 'phone', 'role', 'assignedSites', 'active']) {
      if (req.body[key] !== undefined) user[key] = req.body[key];
    }
    if (req.body.password) user.password = req.body.password;
    await user.save();
    await user.populate('assignedSites', 'name');
    res.json(user);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user._id.toString()) throw new HttpError(400, 'You cannot disable your own account');
    const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ message: 'User disabled' });
  })
);

export default router;
