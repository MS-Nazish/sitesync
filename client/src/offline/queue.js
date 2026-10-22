// Attendance saved while offline lives in IndexedDB (it can hold photo files) until it is uploaded.
// One item per site + day; marking the same sheet again offline merges into it.

const DB_NAME = 'sitesync-offline';
const STORE = 'attendance';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const listQueued = () => run('readonly', (s) => s.getAll()).then((items) => items || []);
export const putQueued = (item) => run('readwrite', (s) => s.put(item));
export const removeQueued = (id) => run('readwrite', (s) => s.delete(id));
export const clearQueue = () => run('readwrite', (s) => s.clear());

export const queueId = (site, date) => `${site}_${date}`;

// Adds a sheet to the queue, merging with anything already waiting for the same site and day
export async function enqueueAttendance({ site, siteName, date, entries, gps, photo, userId }) {
  const id = queueId(site, date);
  const existing = (await listQueued()).find((i) => i.id === id);
  const byWorker = new Map((existing?.entries || []).map((e) => [e.worker, e]));
  entries.forEach((e) => byWorker.set(e.worker, e));

  await putQueued({
    id,
    site,
    siteName,
    date,
    userId,
    entries: [...byWorker.values()],
    gps: gps || existing?.gps || null,
    photo: photo || existing?.photo || null,
    capturedAt: existing?.capturedAt || new Date().toISOString(),
    status: 'pending',
    error: null,
  });
}
