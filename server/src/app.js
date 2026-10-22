import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { UPLOAD_ROOT } from './middleware/upload.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import siteRoutes from './routes/sites.js';
import workerRoutes from './routes/workers.js';
import attendanceRoutes from './routes/attendance.js';
import advanceRoutes from './routes/advances.js';
import payrollRoutes from './routes/payroll.js';
import dashboardRoutes from './routes/dashboard.js';
import publicRoutes from './routes/public.js';

export function createApp() {
  const app = express();
  // Behind Render / Vercel proxies: use the real https scheme and visitor address
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/sites', siteRoutes);
  app.use('/api/workers', workerRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/advances', advanceRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/public', publicRoutes);

  // In production, serve the built React app from the same server
  const clientDist = path.resolve('../client/dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
