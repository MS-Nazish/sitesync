// Vercel serverless entry: every request (see vercel.json) is handled by the same Express app.
// The app and the MongoDB connection are created once per warm instance and reused.
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { connectDB } from '../src/config/db.js';

let app;
let connecting;

async function ready() {
  if (mongoose.connection.readyState !== 1) {
    connecting ||= connectDB(process.env.MONGO_URI).finally(() => {
      connecting = null;
    });
    await connecting;
  }
  app ||= createApp();
  return app;
}

export default async function handler(req, res) {
  try {
    const instance = await ready();
    return instance(req, res);
  } catch (err) {
    console.error('Startup failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Server is starting or cannot reach the database. Try again shortly.' }));
  }
}
