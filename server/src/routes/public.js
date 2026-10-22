import { Router } from 'express';
import Payroll from '../models/Payroll.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { slipLinkDays, verifySlipToken } from '../services/messaging.js';
import { wageSlipPdf } from '../services/reports.js';

// Routes that need no login. The signed token in the link is the permission.
const router = Router();

router.get(
  '/slip/:token',
  asyncHandler(async (req, res) => {
    const { p, w } = verifySlipToken(req.params.token);
    const payroll = await Payroll.findById(p).populate('site', 'name address');
    const line = payroll?.status !== 'draft' && payroll?.lines.find((l) => l.worker.toString() === w);
    if (!line) throw new HttpError(404, 'This wage slip is no longer available');
    const expired = Date.now() - Date.parse(`${payroll.weekEnd}T23:59:59Z`) > slipLinkDays() * 864e5;
    if (expired) throw new HttpError(404, 'This wage slip link has expired. Ask your contractor for a new one.');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="wage-slip-${payroll.weekStart}.pdf"`);
    wageSlipPdf(payroll, line, res);
  })
);

export default router;
