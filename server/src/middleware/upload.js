import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { HttpError } from '../utils/asyncHandler.js';

export const UPLOAD_ROOT = path.resolve('uploads');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Saves images to uploads/<folder>/ and exposes them at /uploads/<folder>/<file>
export function imageUpload(folder) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      ALLOWED.includes(file.mimetype)
        ? cb(null, true)
        : cb(new HttpError(400, 'Only JPG, PNG or WEBP images are allowed')),
  });
}

export const publicPath = (folder, file) => (file ? `/uploads/${folder}/${file.filename}` : undefined);
