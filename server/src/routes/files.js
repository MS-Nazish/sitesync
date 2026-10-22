import { Router } from 'express';
import File from '../models/File.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

// Serves stored photos. No login needed so <img> tags work; the random 32-char id is the protection.
const router = Router();

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(req.params.id)) throw new HttpError(404, 'File not found');
    const file = await File.findById(req.params.id).lean();
    if (!file) throw new HttpError(404, 'File not found');
    res.setHeader('Content-Type', file.contentType);
    // A file never changes once saved, so browsers and the offline cache can keep it
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file.data.buffer ? Buffer.from(file.data.buffer) : file.data);
  })
);

export default router;
