import mongoose from 'mongoose';

export const ATTENDANCE_STATUS = ['present', 'half_day', 'absent'];

const attendanceSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    status: { type: String, enum: ATTENDANCE_STATUS, required: true },
    overtimeHours: { type: Number, default: 0, min: 0, max: 16 },
    // Rates copied from the worker on the day, so later wage changes don't rewrite history
    dailyWage: { type: Number, required: true },
    overtimeRate: { type: Number, required: true },
    // Proof captured on the phone when marking
    gps: {
      lat: Number,
      lng: Number,
      accuracy: Number,
    },
    distanceFromSite: { type: Number },
    outsideGeofence: { type: Boolean, default: false },
    photo: { type: String },
    note: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Set when the phone was offline: saved on the device first and uploaded later
    offline: { type: Boolean, default: false },
    capturedAt: { type: Date },
  },
  { timestamps: true }
);

// One record per worker per day
attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });
attendanceSchema.index({ site: 1, date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
