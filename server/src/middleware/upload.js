import multer from 'multer';
import File from '../models/File.js';
import { HttpError } from '../utils/asyncHandler.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// Keeps the uploaded image in memory; saveImage() then stores it in MongoDB.
// 4 MB limit: serverless hosts reject request bodies over ~4.5 MB.
export const imageUpload = () =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG or WEBP images are allowed')),
  });

// Saves an uploaded image and returns the URL the app uses to show it (or undefined if none)
export async function saveImage(kind, file) {
  if (!file) return undefined;
  const doc = await File.create({ data: file.buffer, contentType: file.mimetype, size: file.size, kind });
  return `/api/files/${doc._id}`;
}
