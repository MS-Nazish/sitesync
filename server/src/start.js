import { connectDB } from './config/db.js';
import { createApp } from './app.js';

export async function start(mongoUri = process.env.MONGO_URI) {
  if (!mongoUri) {
    console.error('MONGO_URI is missing. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  await connectDB(mongoUri);
  const port = process.env.PORT || 5000;
  return createApp().listen(port, () => console.log(`API running on http://localhost:${port}`));
}
