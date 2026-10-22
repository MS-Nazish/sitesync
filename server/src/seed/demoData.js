import User from '../models/User.js';
import Site from '../models/Site.js';
import Worker from '../models/Worker.js';
import Attendance from '../models/Attendance.js';
import Advance from '../models/Advance.js';
import Payroll from '../models/Payroll.js';
import { addDays, todayString, weekRange } from '../utils/dates.js';
import { buildPayrollLines } from '../services/payroll.js';
import { distanceInMeters } from '../utils/geo.js';

export const DEMO_LOGINS = [
  { role: 'admin', email: 'admin@sitesync.com', password: 'admin123' },
  { role: 'supervisor', email: 'ali@sitesync.com', password: 'super123' },
  { role: 'supervisor', email: 'bilal@sitesync.com', password: 'super123' },
];

// Small deterministic random generator so every seed produces the same data
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const SITE_DATA = [
  {
    name: 'DHA Phase 6 — House 42',
    address: 'Block C, DHA Phase 6, Lahore',
    clientName: 'Mr. Imran Qureshi',
    location: { lat: 31.4697, lng: 74.443 },
    workers: [
      ['Muhammad Aslam', 'Mason', 2500],
      ['Ghulam Rasool', 'Mason', 2400],
      ['Shahid Iqbal', 'Helper', 1600],
      ['Riaz Ahmed', 'Helper', 1500],
      ['Nadeem Abbas', 'Steel Fixer', 2200],
      ['Asif Mehmood', 'Carpenter', 2600],
      ['Javed Akhtar', 'Helper', 1500],
      ['Sajid Hussain', 'Electrician', 3000],
    ],
  },
  {
    name: 'Bahria Town Commercial Plaza',
    address: 'Sector C, Bahria Town, Lahore',
    clientName: 'Al-Noor Builders',
    location: { lat: 31.3656, lng: 74.1855 },
    workers: [
      ['Tariq Mahmood', 'Mason', 2600],
      ['Zahid Ali', 'Helper', 1600],
      ['Arshad Khan', 'Helper', 1550],
      ['Waseem Akram', 'Welder', 2800],
      ['Imtiaz Hussain', 'Plumber', 2700],
      ['Kashif Raza', 'Operator', 3200],
      ['Abdul Ghaffar', 'Painter', 2300],
    ],
  },
];

export async function seedDemo({ log = console.log } = {}) {
  await Promise.all([
    User.deleteMany({}),
    Site.deleteMany({}),
    Worker.deleteMany({}),
    Attendance.deleteMany({}),
    Advance.deleteMany({}),
    Payroll.deleteMany({}),
  ]);

  const rand = rng(42);
  const today = todayString();

  const admin = await User.create({
    name: 'Site Admin',
    email: DEMO_LOGINS[0].email,
    password: DEMO_LOGINS[0].password,
    role: 'admin',
    phone: '0300-1234567',
  });

  const sites = [];
  for (const s of SITE_DATA) {
    sites.push(
      await Site.create({
        name: s.name,
        address: s.address,
        clientName: s.clientName,
        location: s.location,
        radiusMeters: 200,
        weekStartDay: 6,
        startDate: addDays(today, -60),
        createdBy: admin._id,
      })
    );
  }

  const supervisors = await Promise.all([
    User.create({
      name: 'Ali Raza',
      email: DEMO_LOGINS[1].email,
      password: DEMO_LOGINS[1].password,
      role: 'supervisor',
      phone: '0321-7654321',
      assignedSites: [sites[0]._id],
    }),
    User.create({
      name: 'Bilal Ahmed',
      email: DEMO_LOGINS[2].email,
      password: DEMO_LOGINS[2].password,
      role: 'supervisor',
      phone: '0333-1112223',
      assignedSites: [sites[1]._id],
    }),
  ]);

  // Attendance for the last 20 days (today is left unmarked so you can try it)
  const firstDay = addDays(today, -20);
  for (let i = 0; i < sites.length; i += 1) {
    const site = sites[i];
    const supervisor = supervisors[i];
    const workers = await Worker.insertMany(
      SITE_DATA[i].workers.map(([name, skill, wage], n) => ({
        name,
        skill,
        dailyWage: wage,
        phone: `03${String(10 + n).padStart(2, '0')}-${String(1000000 + Math.floor(rand() * 8999999))}`,
        site: site._id,
        joinedAt: addDays(today, -45),
      }))
    );

    const records = [];
    for (let d = firstDay; d < today; d = addDays(d, 1)) {
      // A random point near the site; ~1 in 25 days is marked from far away and gets flagged
      const far = rand() < 0.04;
      const gps = {
        lat: site.location.lat + (far ? 0.01 : (rand() - 0.5) * 0.002),
        lng: site.location.lng + (far ? 0.01 : (rand() - 0.5) * 0.002),
        accuracy: Math.round(8 + rand() * 25),
      };
      const distanceFromSite = distanceInMeters(gps, site.location);
      for (const w of workers) {
        const r = rand();
        const status = r < 0.82 ? 'present' : r < 0.91 ? 'half_day' : 'absent';
        records.push({
          worker: w._id,
          site: site._id,
          date: d,
          status,
          overtimeHours: status === 'present' && rand() < 0.2 ? Math.ceil(rand() * 3) : 0,
          dailyWage: w.dailyWage,
          overtimeRate: Math.round(w.dailyWage / 8),
          gps,
          distanceFromSite,
          outsideGeofence: distanceFromSite > site.radiusMeters,
          markedBy: supervisor._id,
        });
      }
    }
    await Attendance.insertMany(records);

    const advances = [];
    for (let k = 0; k < 9; k += 1) {
      const w = workers[Math.floor(rand() * workers.length)];
      advances.push({
        worker: w._id,
        site: site._id,
        amount: [1000, 2000, 3000, 5000][Math.floor(rand() * 4)],
        date: addDays(today, -Math.floor(rand() * 20)),
        note: ['Family need', 'Medical', 'Travel home', 'Rent'][Math.floor(rand() * 4)],
        givenBy: supervisor._id,
      });
    }
    // One worker takes a big advance so the "carry forward" feature shows up
    advances.push({
      worker: workers[2]._id,
      site: site._id,
      amount: 15000,
      date: weekRange(addDays(today, -14), site.weekStartDay).start,
      note: 'Wedding in family',
      givenBy: admin._id,
    });
    await Advance.insertMany(advances);

    // Completed weeks before the current one: the older is paid, the newer is approved
    const current = weekRange(today, site.weekStartDay);
    const weeks = [addDays(current.start, -14), addDays(current.start, -7)];
    for (const [idx, start] of weeks.entries()) {
      const end = addDays(start, 6);
      const { lines, totals } = await buildPayrollLines(site._id, start, end);
      if (!lines.length) continue;
      const status = idx === 0 ? 'paid' : 'approved';
      const payroll = await Payroll.create({
        site: site._id,
        weekStart: start,
        weekEnd: end,
        lines,
        totals,
        status,
        generatedBy: supervisor._id,
        approvedBy: admin._id,
        approvedAt: new Date(),
        paidAt: status === 'paid' ? new Date() : undefined,
      });
      await Advance.updateMany({ site: site._id, date: { $gte: start, $lte: end } }, { payroll: payroll._id });
    }
  }

  log('Demo data created. Logins:');
  DEMO_LOGINS.forEach((l) => log(`  ${l.role.padEnd(10)} ${l.email} / ${l.password}`));
}
