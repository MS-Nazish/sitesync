import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { appTimeZone } from '../utils/dates.js';

const CURRENCY = process.env.CURRENCY_LABEL || 'Rs';
const money = (n) => `${CURRENCY} ${Math.round(n || 0).toLocaleString('en-US')}`;
const STATUS = { draft: 'DRAFT', approved: 'APPROVED', paid: 'PAID' };

const COLUMNS = [
  { key: 'workerName', label: 'Worker', width: 120 },
  { key: 'skill', label: 'Skill', width: 62 },
  { key: 'dailyWage', label: 'Rate', width: 52, money: true },
  { key: 'presentDays', label: 'P', width: 26 },
  { key: 'halfDays', label: 'H', width: 26 },
  { key: 'absentDays', label: 'A', width: 26 },
  { key: 'overtimeHours', label: 'OT h', width: 34 },
  { key: 'gross', label: 'Gross', width: 66, money: true },
  { key: 'advances', label: 'Advances', width: 62, money: true },
  { key: 'previousBalance', label: 'Prev bal', width: 58, money: true },
  { key: 'netPay', label: 'Net pay', width: 70, money: true },
  { key: 'carryForward', label: 'Carry', width: 56, money: true },
  { key: 'sign', label: 'Signature', width: 90 },
];

function header(doc, payroll, title) {
  doc.font('Helvetica-Bold').fontSize(16).text(title, { align: 'left' });
  doc.moveDown(0.2).font('Helvetica').fontSize(10);
  doc.text(`Site: ${payroll.site.name}${payroll.site.address ? ` — ${payroll.site.address}` : ''}`);
  doc.text(`Week: ${payroll.weekStart} to ${payroll.weekEnd}    Status: ${STATUS[payroll.status]}`);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB', { timeZone: appTimeZone() })}`);
  doc.moveDown(0.8);
}

// Weekly wage sheet for a whole site (landscape A4)
export function payrollPdf(payroll, stream) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  doc.pipe(stream);
  header(doc, payroll, 'Weekly Labour Payroll');

  const left = doc.page.margins.left;
  const rowH = 20;
  let y = doc.y;

  const drawRow = (cells, { bold = false, fill } = {}) => {
    if (y + rowH > doc.page.height - doc.page.margins.bottom - 60) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    let x = left;
    const totalW = COLUMNS.reduce((s, c) => s + c.width, 0);
    if (fill) doc.rect(left, y, totalW, rowH).fill(fill).fillColor('black');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    COLUMNS.forEach((col, i) => {
      doc.rect(x, y, col.width, rowH).strokeColor('#bbbbbb').lineWidth(0.5).stroke();
      doc.text(String(cells[i] ?? ''), x + 3, y + 6, { width: col.width - 6, ellipsis: true, lineBreak: false });
      x += col.width;
    });
    y += rowH;
  };

  drawRow(COLUMNS.map((c) => c.label), { bold: true, fill: '#e8eef7' });
  for (const line of payroll.lines) {
    drawRow(COLUMNS.map((c) => (c.key === 'sign' ? '' : c.money ? money(line[c.key]) : line[c.key])));
  }
  const t = payroll.totals;
  drawRow(
    COLUMNS.map((c) => {
      if (c.key === 'workerName') return `TOTAL (${t.workers} workers)`;
      if (c.key === 'gross') return money(t.gross);
      if (c.key === 'advances') return money(t.advances);
      if (c.key === 'netPay') return money(t.netPay);
      return '';
    }),
    { bold: true, fill: '#f3f3f3' }
  );

  doc.font('Helvetica').fontSize(8).fillColor('#555555');
  doc.text('P = present, H = half day, A = absent, OT = overtime hours. Carry = advance balance moved to next week.', left, y + 10);
  doc.fillColor('black').fontSize(10);
  const sigY = y + 50;
  doc.text('Prepared by: ____________________', left, sigY);
  doc.text('Approved by: ____________________', left + 300, sigY);
  doc.end();
}

// Individual wage slip for one worker (A5)
export function wageSlipPdf(payroll, line, stream) {
  const doc = new PDFDocument({ size: 'A5', margin: 36 });
  doc.pipe(stream);
  header(doc, payroll, 'Wage Slip');

  const rows = [
    ['Worker', line.workerName],
    ['Skill', line.skill],
    ['Daily rate', money(line.dailyWage)],
    ['Days present', line.presentDays],
    ['Half days', line.halfDays],
    ['Days absent', line.absentDays],
    ['Overtime hours', line.overtimeHours],
    ['Wages', money(line.wages)],
    ['Overtime pay', money(line.overtimePay)],
    ['Gross earnings', money(line.gross)],
    ['Advances this week', `- ${money(line.advances)}`],
    ['Previous balance', `- ${money(line.previousBalance)}`],
    ['NET PAY', money(line.netPay)],
    ['Balance carried to next week', money(line.carryForward)],
  ];

  const left = doc.page.margins.left;
  const width = doc.page.width - left * 2;
  let y = doc.y;
  rows.forEach(([label, value]) => {
    const bold = label === 'NET PAY';
    if (bold) doc.rect(left, y - 3, width, 20).fill('#e8f5e9').fillColor('black');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10);
    doc.text(label, left + 4, y, { width: width / 2 });
    doc.text(String(value), left + width / 2, y, { width: width / 2 - 4, align: 'right' });
    y += 20;
  });

  doc.font('Helvetica').fontSize(10);
  doc.text('Worker signature / thumb: ________________', left, y + 30);
  doc.end();
}

export async function payrollExcel(payroll) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SiteSync';
  const ws = wb.addWorksheet('Payroll');

  ws.addRow(['Weekly Labour Payroll']).font = { bold: true, size: 14 };
  ws.addRow([`Site: ${payroll.site.name}`]);
  ws.addRow([`Week: ${payroll.weekStart} to ${payroll.weekEnd}`, '', '', `Status: ${STATUS[payroll.status]}`]);
  ws.addRow([]);

  const cols = [
    ['Worker', 'workerName', 24],
    ['Skill', 'skill', 14],
    ['Daily rate', 'dailyWage', 12],
    ['Present', 'presentDays', 9],
    ['Half days', 'halfDays', 9],
    ['Absent', 'absentDays', 9],
    ['OT hours', 'overtimeHours', 10],
    ['Wages', 'wages', 12],
    ['OT pay', 'overtimePay', 12],
    ['Gross', 'gross', 12],
    ['Advances', 'advances', 12],
    ['Prev balance', 'previousBalance', 13],
    ['Net pay', 'netPay', 13],
    ['Carry forward', 'carryForward', 14],
  ];
  const head = ws.addRow(cols.map((c) => c[0]));
  head.font = { bold: true };
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });
  cols.forEach((c, i) => {
    ws.getColumn(i + 1).width = c[2];
  });

  payroll.lines.forEach((line) => ws.addRow(cols.map((c) => line[c[1]])));
  const t = payroll.totals;
  const total = ws.addRow(['TOTAL', `${t.workers} workers`, '', '', '', '', '', '', '', t.gross, t.advances, '', t.netPay, '']);
  total.font = { bold: true };

  [3, 8, 9, 10, 11, 12, 13, 14].forEach((i) => {
    ws.getColumn(i).numFmt = '#,##0';
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
