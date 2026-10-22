import 'dotenv/config';
import { start } from './start.js';

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
