import crypto from 'crypto';
import { HttpError } from '../utils/asyncHandler.js';
import { appSecret } from '../config/secrets.js';

// ---------- Phone numbers ----------

// Converts local numbers like "0300-1234567" to international digits "923001234567" (no plus sign)
export function normalizePhone(raw, countryCode = process.env.DEFAULT_COUNTRY_CODE || '92') {
  if (!raw) return null;
  let digits = String(raw).trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = countryCode + digits.slice(1);
  else if (digits.length <= 10) digits = countryCode + digits;
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

// ---------- Public wage slip links ----------

// Signed link so a worker can open their slip without logging in.
// Kept short on purpose (payroll id + worker id + 16-char signature ≈ 64 chars): an Urdu SMS
// segment holds only 70 characters, and a JWT would add ~4 extra paid segments per message.
const signSlip = (p, w) =>
  crypto.createHmac('sha256', appSecret()).update(`slip:${p}:${w}`).digest('base64url').slice(0, 16);

export function slipToken(payrollId, workerId) {
  const p = String(payrollId);
  const w = String(workerId);
  return `${p}${w}${signSlip(p, w)}`;
}

export function verifySlipToken(token) {
  const match = /^([a-f0-9]{24})([a-f0-9]{24})([\w-]{16})$/.exec(token || '');
  const expected = match && Buffer.from(signSlip(match[1], match[2]));
  if (!match || !crypto.timingSafeEqual(Buffer.from(match[3]), expected)) {
    throw new HttpError(404, 'This wage slip link is invalid or has expired');
  }
  return { p: match[1], w: match[2] };
}

// Links stop working this many days after the payroll week ends
export const slipLinkDays = () => Number(process.env.SLIP_LINK_DAYS || 60);

export function publicBaseUrl(req) {
  return (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

// ---------- Message text (English / Urdu) ----------

const TEXT = {
  en: {
    title: 'Wage slip',
    name: 'Name',
    site: 'Site',
    week: 'Week',
    days: (l) => `Days: ${l.presentDays} full, ${l.halfDays} half, ${l.absentDays} absent`,
    overtime: (h) => `Overtime: ${h} hours`,
    gross: 'Earned',
    advances: 'Advance cut',
    previous: 'Old balance cut',
    net: 'NET PAY',
    carry: 'Advance still due',
    slip: 'Slip',
    money: (n) => `Rs ${Math.round(n).toLocaleString('en-US')}`,
    locale: 'en-GB',
  },
  ur: {
    title: 'تنخواہ کی پرچی',
    name: 'نام',
    site: 'سائٹ',
    week: 'ہفتہ',
    days: (l) => `دن: ${l.presentDays} پورے، ${l.halfDays} آدھے، ${l.absentDays} غیر حاضر`,
    overtime: (h) => `اوور ٹائم: ${h} گھنٹے`,
    gross: 'کمائی',
    advances: 'ایڈوانس کٹوتی',
    previous: 'پرانا بقایا کٹوتی',
    net: 'ادائیگی',
    carry: 'باقی ایڈوانس',
    slip: 'پرچی',
    money: (n) => `${Math.round(n).toLocaleString('en-US')} روپے`,
    locale: 'ur-PK',
  },
};

const fmtDate = (d, locale) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function buildSlipMessage({ payroll, line, lang = 'en', slipUrl }) {
  const t = TEXT[lang] || TEXT.en;
  const lines = [
    `*${t.title}* — ${payroll.site.name}`,
    `${t.name}: ${line.workerName}`,
    `${t.week}: ${fmtDate(payroll.weekStart, t.locale)} – ${fmtDate(payroll.weekEnd, t.locale)}`,
    t.days(line),
  ];
  if (line.overtimeHours) lines.push(t.overtime(line.overtimeHours));
  lines.push(`${t.gross}: ${t.money(line.gross)}`);
  if (line.advances) lines.push(`${t.advances}: ${t.money(line.advances)}`);
  if (line.previousBalance) lines.push(`${t.previous}: ${t.money(line.previousBalance)}`);
  lines.push(`*${t.net}: ${t.money(line.netPay)}*`);
  if (line.carryForward) lines.push(`${t.carry}: ${t.money(line.carryForward)}`);
  if (slipUrl) lines.push(`${t.slip}: ${slipUrl}`);
  return lines.join('\n');
}

// ---------- Sending ----------
//
// MESSAGE_PROVIDER=none     (default) the app only builds WhatsApp / SMS links that you tap to send
// MESSAGE_PROVIDER=console  prints messages in the server log (for demos and testing)
// MESSAGE_PROVIDER=twilio   sends real SMS / WhatsApp messages through Twilio

export function providerInfo() {
  const provider = process.env.MESSAGE_PROVIDER || 'none';
  if (provider === 'console') return { provider, sms: true, whatsapp: true };
  if (provider === 'twilio') {
    return {
      provider,
      sms: Boolean(process.env.TWILIO_SMS_FROM),
      whatsapp: Boolean(process.env.TWILIO_WHATSAPP_FROM),
    };
  }
  return { provider: 'none', sms: false, whatsapp: false };
}

async function sendViaTwilio({ channel, to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tokenValue = process.env.TWILIO_AUTH_TOKEN;
  const from = channel === 'whatsapp' ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
  if (!sid || !tokenValue || !from) throw new Error(`Twilio ${channel} is not configured`);

  const prefix = channel === 'whatsapp' ? 'whatsapp:' : '';
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${tokenValue}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: `${prefix}+${to}`,
      From: from.startsWith(prefix) ? from : `${prefix}${from}`,
      Body: body,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio error ${res.status}`);
  return data.sid;
}

export async function sendMessage({ channel, to, body }) {
  const info = providerInfo();
  if (!info[channel]) throw new HttpError(501, `Sending ${channel} from the server is not set up (MESSAGE_PROVIDER=${info.provider})`);
  if (info.provider === 'console') {
    console.log(`\n[${channel.toUpperCase()} → +${to}]\n${body}\n`);
    return 'console';
  }
  return sendViaTwilio({ channel, to, body });
}
