import type { ImportedRecipient, AppSettings } from '@/types';

export function sanitiseTemplate(raw: string): string {
  return raw
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function calculateSegments(message: string): { chars: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } {
  const s = message.replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
  const gsm7 = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüàÉ^{}\\\[~\]|€]*$/;
  if (gsm7.test(s)) {
    return { chars: s.length, segments: s.length <= 160 ? 1 : Math.ceil(s.length / 153), encoding: 'GSM-7' };
  }
  return { chars: s.length, segments: s.length <= 70 ? 1 : Math.ceil(s.length / 67), encoding: 'UCS-2' };
}

export function normaliseAustralianMobile(raw: string | null): {
  display: string; forCopy: string; isValid: boolean; invalidReason: string | null;
} {
  if (!raw) return { display: '', forCopy: '', isValid: false, invalidReason: 'Missing' };
  let s = String(raw).replace(/[\s\u202f\u00a0\-().]/g, '');
  if (s.startsWith('+61')) s = '0' + s.slice(3);
  if (s.startsWith('61') && s.length === 11) s = '0' + s.slice(2);
  if (/^04\d{8}$/.test(s)) {
    return { display: s.replace(/^(04\d{2})(\d{3})(\d{3})$/, '$1 $2 $3'), forCopy: s, isValid: true, invalidReason: null };
  }
  if (/^0[2378]\d{8}$/.test(s)) {
    return { display: String(raw), forCopy: '', isValid: false, invalidReason: 'Landline — cannot send SMS' };
  }
  return { display: String(raw), forCopy: '', isValid: false, invalidReason: 'Invalid Australian mobile' };
}

export function firstNameForSms(rawFirstName: string): string {
  const token = rawFirstName.trim().split(/\s+/)[0];
  if (token.length > 1 && token === token.toUpperCase()) {
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }
  return token;
}

export function isAlreadyTexted(colE: unknown): boolean {
  if (colE === true) return true;
  if (typeof colE === 'string') {
    const s = colE.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

export function renderMessage(template: string, recipient: Pick<ImportedRecipient, 'firstNameForSms'>, settings: AppSettings): string {
  return template
    .replace(/\{firstName\}/g, recipient.firstNameForSms)
    .replace(/\{pharmacyName\}/g, settings.pharmacyName)
    .replace(/\{pharmacyPhone\}/g, settings.pharmacyPhone)
    .replace(/\{bookingLink\}/g, settings.bookingLink)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
