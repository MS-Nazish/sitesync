import { Router } from 'express';
import User from '../models/User.js';
import { protect, signToken } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router = Router();

const userPayload = async (user) => {
  await user.populate('assignedSites', 'name status');
  return { token: signToken(user), user };
};

// Tells the login page whether the first admin still needs to be created
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({ needsSetup: (await User.countDocuments()) === 0 });
  })
);

// First-run only: creates the contractor/admin account
router.post(
  '/setup',
  asyncHandler(async (req, res) => {
    if ((await User.countDocuments()) > 0) throw new HttpError(403, 'Setup has already been completed');
    const { name, email, password, phone } = req.body;
    const user = await User.create({ name, email, password, phone, role: 'admin' });
    res.status(201).json(await userPayload(user));
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'Email and password are required');
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
    if (!user || !(await user.matchPassword(password))) throw new HttpError(401, 'Invalid email or password');
    if (!user.active) throw new HttpError(403, 'This account has been disabled');
    res.json(await userPayload(user));
  })
);

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    await req.user.populate('assignedSites', 'name status');
    res.json({ user: req.user });
  })
);

router.put(
  '/password',
  protect,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword || ''))) throw new HttpError(400, 'Current password is wrong');
    if (!newPassword || newPassword.length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  })
);

export default router;
