import mongoose from 'mongoose';

const siteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    clientName: { type: String, trim: true },
    // Site centre used for the GPS check on attendance
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    // Attendance marked further than this from the site is flagged
    radiusMeters: { type: Number, default: 200, min: 20 },
    // Day the payroll week starts on: 0 = Sunday ... 6 = Saturday
    weekStartDay: { type: Number, default: 6, min: 0, max: 6 },
    status: { type: String, enum: ['active', 'on_hold', 'completed'], default: 'active' },
    startDate: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Site', siteSchema);
