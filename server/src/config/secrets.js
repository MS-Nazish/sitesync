import crypto from 'crypto';

// Key used to sign login tokens and wage-slip links.
// Uses JWT_SECRET when set. Otherwise it is derived from MONGO_URI, which is already a server-only secret,
// so a deployment only has to be given the database address. (Changing the database password then
// logs everyone out, which is harmless.)
let cached;
export function appSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!process.env.MONGO_URI) throw new Error('Set JWT_SECRET or MONGO_URI');
  cached ||= crypto.createHash('sha256').update(`sitesync-signing-key:${process.env.MONGO_URI}`).digest('hex');
  return cached;
}
