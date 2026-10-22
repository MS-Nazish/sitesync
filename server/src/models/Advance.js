import mongoose from 'mongoose';

const advanceSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    amount: { type: Number, required: true, min: 1 },
    date: { type: String, required: true }, // YYYY-MM-DD
    note: { type: String, trim: true },
    givenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Set when an approved payroll deducts this advance; it is locked after that
    payroll: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', default: null },
  },
  { timestamps: true }
);

advanceSchema.index({ site: 1, date: 1 });
advanceSchema.index({ worker: 1, date: 1 });

export default mongoose.model('Advance', advanceSchema);
