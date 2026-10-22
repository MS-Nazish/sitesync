// Runs the API against a throwaway in-memory MongoDB filled with demo data.
// Handy for trying the app without installing MongoDB. Data is lost when you stop it.
import 'dotenv/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { start } from './start.js';
import { seedDemo } from './seed/demoData.js';

process.env.JWT_SECRET ||= 'dev-only-secret-change-me';
// Demo mode: "send" slips by printing them in this terminal
process.env.MESSAGE_PROVIDER ||= 'console';

const mongo = await MongoMemoryServer.create();
console.log('In-memory MongoDB started (data resets on every restart)');
await start(mongo.getUri('sitesync'));
await seedDemo();

const shutdown = async () => {
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
