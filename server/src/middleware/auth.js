import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { HttpError, asyncHandler } from '../utils/asyncHandler.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Requires a valid "Authorization: Bearer <token>" header and an active user
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Session expired, please log in again');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.active) throw new HttpError(401, 'Account not found or disabled');
  req.user = user;
  next();
});

// Restricts a route to the given roles, e.g. authorize('admin')
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission for this action'));
    }
    next();
  };

export const isAdmin = (req) => req.user.role === 'admin';

// Mongo filter limiting a query to the sites the user may see
export function siteScope(req, field = 'site') {
  if (isAdmin(req)) return {};
  return { [field]: { $in: req.user.assignedSites } };
}

export function canAccessSite(req, siteId) {
  if (isAdmin(req)) return true;
  return req.user.assignedSites.some((id) => id.toString() === String(siteId));
}

export function assertSiteAccess(req, siteId) {
  if (!siteId || !mongoose.isValidObjectId(siteId)) throw new HttpError(400, 'A valid site is required');
  if (!canAccessSite(req, siteId)) throw new HttpError(403, 'You are not assigned to this site');
}
