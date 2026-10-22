import { Router } from 'express';
import Payroll from '../models/Payroll.js';
import Advance from '../models/Advance.js';
import Site from '../models/Site.js';
import Worker from '../models/Worker.js';
import { protect, authorize, siteScope, assertSiteAccess } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { isDateString, todayString, weekRange } from '../utils/dates.js';
import { buildPayrollLines } from '../services/payroll.js';
import { payrollPdf, payrollExcel, wageSlipPdf } from '../services/reports.js';
import {
  buildSlipMessage,
  normalizePhone,
  providerInfo,
  publicBaseUrl,
  sendMessage,
  slipToken,
} from '../services/messaging.js';

const router = Router();
router.use(protect);

async function loadPayroll(req) {
  const payroll = await Payroll.findById(req.params.id)
    .populate('site', 'name address weekStartDay')
    .populate('generatedBy', 'name')
    .populate('approvedBy', 'name');
  if (!payroll) throw new HttpError(404, 'Payroll not found');
  assertSiteAccess(req, payroll.site._id);
  return payroll;
}

const fileName = (payroll, suffix) =>
  `payroll-${payroll.site.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${payroll.weekStart}${suffix}`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = siteScope(req);
    if (req.query.site) {
      assertSiteAccess(req, req.query.site);
      filter.site = req.query.site;
    }
    if (req.query.status) filter.status = req.query.status;
    const payrolls = await Payroll.find(filter, { lines: 0 })
      .populate('site', 'name')
      .sort({ weekStart: -1, createdAt: -1 })
      .limit(200);
    res.json(payrolls);
  })
);

// Preview the week a date falls in for a site (used by the "Generate" form)
router.get(
  '/week',
  asyncHandler(async (req, res) => {
    assertSiteAccess(req, req.query.site);
    const site = await Site.findById(req.query.site);
    if (!site) throw new HttpError(404, 'Site not found');
    const date = isDateString(req.query.date) ? req.query.date : todayString();
    res.json(weekRange(date, site.weekStartDay));
  })
);

// Create or refresh the draft payroll for the week containing `date`
router.post(
  '/generate',
  authorize('admin', 'supervisor'),
  asyncHandler(async (req, res) => {
    const { site: siteId } = req.body;
    const date = req.body.date || todayString();
    assertSiteAccess(req, siteId);
    if (!isDateString(date)) throw new HttpError(400, 'Invalid date');

    const site = await Site.findById(siteId);
    if (!site) throw new HttpError(404, 'Site not found');
    const { start, end } = weekRange(date, site.weekStartDay);

    let payroll = await Payroll.findOne({ site: siteId, weekStart: start });
    if (payroll && payroll.status !== 'draft') {
      throw new HttpError(409, `Payroll for ${start} is already ${payroll.status}. Reopen it to regenerate.`);
    }

    const { lines, totals } = await buildPayrollLines(site._id, start, end, payroll?._id);
    if (lines.length === 0) throw new HttpError(400, `No attendance or advances found for ${start} to ${end}`);

    if (!payroll) payroll = new Payroll({ site: site._id, weekStart: start, weekEnd: end });
    payroll.set({ lines, totals, generatedBy: req.user._id, status: 'draft' });
    await payroll.save();
    res.status(201).json(payroll);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await loadPayroll(req));
  })
);

// Approving freezes the numbers: attendance and advances for that week become read-only
router.patch(
  '/:id/approve',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    if (payroll.status !== 'draft') throw new HttpError(409, `Payroll is already ${payroll.status}`);

    // Guard against approving stale numbers if someone edited attendance after the draft was made
    const fresh = await buildPayrollLines(payroll.site._id, payroll.weekStart, payroll.weekEnd, payroll._id);
    if (fresh.totals.netPay !== payroll.totals.netPay || fresh.lines.length !== payroll.lines.length) {
      throw new HttpError(409, 'Attendance or advances changed after this draft was made. Regenerate it and review again.');
    }

    payroll.set({ status: 'approved', approvedBy: req.user._id, approvedAt: new Date() });
    await payroll.save();
    await Advance.updateMany(
      { site: payroll.site._id, date: { $gte: payroll.weekStart, $lte: payroll.weekEnd } },
      { payroll: payroll._id }
    );
    res.json(await loadPayroll(req));
  })
);

router.patch(
  '/:id/pay',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    if (payroll.status !== 'approved') throw new HttpError(409, 'Only an approved payroll can be marked as paid');
    payroll.set({ status: 'paid', paidAt: new Date() });
    await payroll.save();
    res.json(payroll);
  })
);

// Back to draft so mistakes can be fixed (not allowed once wages are paid)
router.patch(
  '/:id/reopen',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    if (payroll.status !== 'approved') throw new HttpError(409, 'Only an approved (unpaid) payroll can be reopened');
    const later = await Payroll.exists({
      'lines.worker': { $in: payroll.lines.map((l) => l.worker) },
      weekStart: { $gt: payroll.weekStart },
      status: { $in: ['approved', 'paid'] },
    });
    if (later) throw new HttpError(409, 'A later week for these workers is already approved; reopen that one first');

    payroll.set({ status: 'draft', approvedBy: undefined, approvedAt: undefined });
    await payroll.save();
    await Advance.updateMany({ payroll: payroll._id }, { payroll: null });
    res.json(await loadPayroll(req));
  })
);

router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    if (payroll.status !== 'draft') throw new HttpError(409, 'Only draft payrolls can be deleted');
    await payroll.deleteOne();
    res.json({ message: 'Draft payroll deleted' });
  })
);

router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName(payroll, '.pdf')}"`);
    payrollPdf(payroll, res);
  })
);

router.get(
  '/:id/excel',
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    const buffer = await payrollExcel(payroll);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName(payroll, '.xlsx')}"`);
    res.send(buffer);
  })
);

router.get(
  '/:id/slip/:workerId',
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    const line = payroll.lines.find((l) => l.worker.toString() === req.params.workerId);
    if (!line) throw new HttpError(404, 'This worker is not in this payroll');
    const name = line.workerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wage-slip-${name}-${payroll.weekStart}.pdf"`);
    wageSlipPdf(payroll, line, res);
  })
);

// Ready-to-send wage slip messages for every worker: text, WhatsApp link, SMS link, public slip link
router.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    if (payroll.status === 'draft') throw new HttpError(409, 'Approve the payroll before sending slips');
    const lang = req.query.lang === 'ur' ? 'ur' : 'en';
    const workers = await Worker.find({ _id: { $in: payroll.lines.map((l) => l.worker) } }, { phone: 1 }).lean();
    const phones = new Map(workers.map((w) => [w._id.toString(), w.phone]));
    const base = publicBaseUrl(req);

    const messages = payroll.lines.map((line) => {
      const workerId = line.worker.toString();
      const phone = normalizePhone(phones.get(workerId));
      const slipUrl = `${base}/api/public/slip/${slipToken(payroll._id, workerId)}`;
      const text = buildSlipMessage({ payroll, line, lang, slipUrl });
      const sent = payroll.notifications.filter((n) => n.worker?.toString() === workerId && n.status === 'sent');
      return {
        worker: workerId,
        name: line.workerName,
        netPay: line.netPay,
        phone: phones.get(workerId) || null,
        intlPhone: phone,
        text,
        slipUrl,
        whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null,
        smsUrl: phone ? `sms:+${phone}?body=${encodeURIComponent(text)}` : null,
        lastSent: sent.length ? sent[sent.length - 1] : null,
      };
    });

    res.json({ lang, provider: providerInfo(), messages });
  })
);

// Send slips from the server through the configured provider (console / Twilio)
router.post(
  '/:id/notify',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const payroll = await loadPayroll(req);
    if (payroll.status === 'draft') throw new HttpError(409, 'Approve the payroll before sending slips');
    const channel = req.body.channel === 'whatsapp' ? 'whatsapp' : 'sms';
    if (!providerInfo()[channel]) {
      throw new HttpError(501, `Server ${channel} sending is not configured. Use the WhatsApp / SMS buttons instead.`);
    }
    const lang = req.body.lang === 'ur' ? 'ur' : 'en';
    const only = Array.isArray(req.body.workers) ? new Set(req.body.workers.map(String)) : null;
    const lines = payroll.lines.filter((l) => !only || only.has(l.worker.toString()));

    const workers = await Worker.find({ _id: { $in: lines.map((l) => l.worker) } }, { phone: 1 }).lean();
    const phones = new Map(workers.map((w) => [w._id.toString(), normalizePhone(w.phone)]));
    const base = publicBaseUrl(req);

    const results = [];
    for (const line of lines) {
      const workerId = line.worker.toString();
      const to = phones.get(workerId);
      const entry = { worker: line.worker, channel, to: to || undefined, by: req.user._id, at: new Date() };
      if (!to) {
        results.push({ ...entry, name: line.workerName, status: 'failed', error: 'No valid phone number' });
        payroll.notifications.push({ ...entry, status: 'failed', error: 'No valid phone number' });
        continue;
      }
      const slipUrl = `${base}/api/public/slip/${slipToken(payroll._id, workerId)}`;
      try {
        await sendMessage({ channel, to, body: buildSlipMessage({ payroll, line, lang, slipUrl }) });
        payroll.notifications.push({ ...entry, status: 'sent' });
        results.push({ ...entry, name: line.workerName, status: 'sent' });
      } catch (err) {
        payroll.notifications.push({ ...entry, status: 'failed', error: err.message });
        results.push({ ...entry, name: line.workerName, status: 'failed', error: err.message });
      }
    }
    await payroll.save();

    res.json({
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    });
  })
);

export default router;
