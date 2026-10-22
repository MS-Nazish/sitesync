// Wipes the database in MONGO_URI and fills it with demo sites, workers, attendance and payrolls
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { seedDemo } from './seed/demoData.js';

try {
  await connectDB(process.env.MONGO_URI);
  await seedDemo();
} catch (err) {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
