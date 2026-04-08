import type { ImportedRecipient, AppSettings } from '@/types';
import { sanitiseTemplate, normaliseAustralianMobile, firstNameForSms, isAlreadyTexted, generateId } from './sms-utils';

declare const XLSX: any;

export interface ParseResult {
  template: string;
  recipients: ImportedRecipient[];
  stats: {
    total: number;
    valid: number;
    alreadyTexted: number;
    duplicates: number;
    invalid: number;
  };
  warnings: string[];
}

export function parseSpreadsheet(arrayBuffer: ArrayBuffer, settings: AppSettings): ParseResult {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  const rawTemplate = rows[0]?.[0] as string || '';
  const template = sanitiseTemplate(rawTemplate);

  const patientRows = rows.slice(3).filter((row: any[]) => row[0] != null);
  const warnings: string[] = [];

  const suppressedMobiles = new Set(settings.suppressionList.map(s => s.mobile));

  const recipients: ImportedRecipient[] = patientRows.map((row: any[], idx: number) => {
    const rowNum = idx + 4;
    const rawFirst = String(row[0] || '').trim();
    const rawLast = String(row[1] || '').trim();
    const rawMobile = row[3] != null ? String(row[3]) : null;
    const mobile = normaliseAustralianMobile(rawMobile);
    const texted = isAlreadyTexted(row[4]);

    if (!mobile.isValid && !texted) {
      warnings.push(`Row ${rowNum}: ${mobile.invalidReason || 'Invalid number'} — ${rawMobile || 'empty'}`);
    }

    return {
      id: generateId(),
      originalRowNumber: rowNum,
      firstName: rawFirst,
      firstNameForSms: firstNameForSms(rawFirst),
      lastName: rawLast,
      mobileRaw: rawMobile || '',
      mobileDisplay: mobile.display,
      mobileForCopy: mobile.forCopy,
      isValidMobile: mobile.isValid,
      invalidReason: mobile.invalidReason,
      isDuplicate: false,
      duplicateOfRow: null,
      isAlreadyTexted: texted,
      isSelected: false,
      isSuppressed: mobile.isValid && suppressedMobiles.has(mobile.forCopy),
    };
  });

  // Duplicate detection
  const mobileGroups = new Map<string, number[]>();
  recipients.forEach((r, i) => {
    if (r.isValidMobile && r.mobileForCopy) {
      const existing = mobileGroups.get(r.mobileForCopy) || [];
      existing.push(i);
      mobileGroups.set(r.mobileForCopy, existing);
    }
  });
  mobileGroups.forEach((indices) => {
    if (indices.length > 1) {
      const firstRow = recipients[indices[0]].originalRowNumber;
      indices.forEach((i, idx) => {
        recipients[i].isDuplicate = true;
        if (idx > 0) {
          recipients[i].duplicateOfRow = firstRow;
          warnings.push(`Row ${recipients[i].originalRowNumber} shares number ${recipients[i].mobileDisplay} with row ${firstRow}`);
        }
      });
    }
  });

  const stats = {
    total: recipients.length,
    valid: recipients.filter(r => r.isValidMobile && !r.isAlreadyTexted && !r.isSuppressed).length,
    alreadyTexted: recipients.filter(r => r.isAlreadyTexted).length,
    duplicates: recipients.filter(r => r.isDuplicate).length,
    invalid: recipients.filter(r => !r.isValidMobile && !r.isAlreadyTexted).length,
  };

  return { template, recipients, stats, warnings };
}

export function exportSpreadsheet(
  originalBuffer: ArrayBuffer,
  sessionRecipients: { originalRowNumber: number; sendStatus: string; sentAt: string | null; notes: string }[],
  sessionName: string
): ArrayBuffer {
  const workbook = XLSX.read(originalBuffer, { type: 'array', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  // Add headers for new columns
  worksheet['F3'] = { t: 's', v: 'Send Status' };
  worksheet['G3'] = { t: 's', v: 'Date Sent' };
  worksheet['H3'] = { t: 's', v: 'Campaign Name' };

  const statusMap = new Map(sessionRecipients.map(r => [r.originalRowNumber, r]));

  sessionRecipients.forEach(r => {
    const excelRow = r.originalRowNumber; // already 1-based from row 4+
    const eCell = `E${excelRow}`;
    const fCell = `F${excelRow}`;
    const gCell = `G${excelRow}`;
    const hCell = `H${excelRow}`;

    if (r.sendStatus === 'sent') {
      worksheet[eCell] = { t: 'b', v: true };
    }

    const statusLabel = r.sendStatus.charAt(0).toUpperCase() + r.sendStatus.slice(1);
    worksheet[fCell] = { t: 's', v: statusLabel };
    worksheet[gCell] = { t: 's', v: r.sentAt || '' };
    worksheet[hCell] = { t: 's', v: sessionName };
  });

  // Update range
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  range.e.c = Math.max(range.e.c, 7); // H = col 7
  worksheet['!ref'] = XLSX.utils.encode_range(range);

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

export function exportCSV(
  recipients: { originalRowNumber: number; firstName: string; lastName: string; mobileDisplay: string; sendStatus: string; sentAt: string | null; notes: string }[],
  sessionName: string
): string {
  const headers = 'Row,First Name,Last Name,Mobile,Send Status,Sent At,Notes,Campaign';
  const rows = recipients.map(r =>
    `${r.originalRowNumber},"${r.firstName}","${r.lastName}","${r.mobileDisplay}",${r.sendStatus},${r.sentAt || ''},"${r.notes || ''}","${sessionName}"`
  );
  return [headers, ...rows].join('\n');
}
