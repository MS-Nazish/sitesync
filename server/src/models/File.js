import crypto from 'crypto';
import mongoose from 'mongoose';

// Photos (worker pictures, attendance proof) live in MongoDB rather than on disk, so they survive
// on hosts with temporary or read-only file systems (Vercel, Render free). Images are compressed on the
// phone first (~100–400 KB), well under MongoDB's 16 MB document limit.
const fileSchema = new mongoose.Schema(
  {
    // Random 32-char id: the photo URL can't be guessed from another one
    _id: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: Number,
    kind: { type: String, enum: ['workers', 'attendance'] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('File', fileSchema);
