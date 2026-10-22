import mongoose from 'mongoose';

const lineSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName: String,
    skill: String,
    dailyWage: Number,
    presentDays: Number,
    halfDays: Number,
    absentDays: Number,
    overtimeHours: Number,
    wages: Number,
    overtimePay: Number,
    gross: Number,
    advances: Number,
    previousBalance: Number,
    deductions: Number,
    netPay: Number,
    carryForward: Number,
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    weekStart: { type: String, required: true },
    weekEnd: { type: String, required: true },
    status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
    lines: [lineSchema],
    totals: {
      workers: Number,
      gross: Number,
      advances: Number,
      deductions: Number,
      netPay: Number,
    },
    // Wage slip messages sent to workers from the server (SMS / WhatsApp)
    notifications: [
      {
        _id: false,
        worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
        channel: { type: String, enum: ['sms', 'whatsapp'] },
        status: { type: String, enum: ['sent', 'failed'] },
        error: String,
        to: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    paidAt: Date,
  },
  { timestamps: true }
);

payrollSchema.index({ site: 1, weekStart: 1 }, { unique: true });
payrollSchema.index({ 'lines.worker': 1, weekStart: -1 });

export default mongoose.model('Payroll', payrollSchema);
