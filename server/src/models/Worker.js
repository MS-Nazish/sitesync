import mongoose from 'mongoose';

export const SKILLS = [
  'Mason',
  'Helper',
  'Carpenter',
  'Steel Fixer',
  'Electrician',
  'Plumber',
  'Painter',
  'Welder',
  'Operator',
  'Other',
];

const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true },
    phone: { type: String, trim: true },
    cnic: { type: String, trim: true },
    skill: { type: String, enum: SKILLS, default: 'Helper' },
    dailyWage: { type: Number, required: true, min: 0 },
    // Pay per overtime hour; defaults to daily wage / 8 when left empty
    overtimeRate: { type: Number, min: 0 },
    photo: { type: String },
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    joinedAt: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

workerSchema.virtual('effectiveOvertimeRate').get(function effectiveOvertimeRate() {
  return this.overtimeRate ?? Math.round((this.dailyWage / 8) * 100) / 100;
});

workerSchema.set('toJSON', { virtuals: true });
workerSchema.index({ site: 1, active: 1 });

export default mongoose.model('Worker', workerSchema);
