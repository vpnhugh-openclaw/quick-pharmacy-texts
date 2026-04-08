export interface ImportedRecipient {
  id: string;
  originalRowNumber: number;
  firstName: string;
  firstNameForSms: string;
  lastName: string;
  mobileRaw: string;
  mobileDisplay: string;
  mobileForCopy: string;
  isValidMobile: boolean;
  invalidReason: string | null;
  isDuplicate: boolean;
  duplicateOfRow: number | null;
  isAlreadyTexted: boolean;
  isSelected: boolean;
  isSuppressed: boolean;
}

export interface SendSession {
  id: string;
  sourceFileName: string;
  messageBodySnapshot: string;
  createdAt: string;
  updatedAt: string;
  status: 'in_progress' | 'paused' | 'completed';
  currentIndex: number;
  complianceAcknowledged: boolean;
  recipients: SendSessionRecipient[];
}

export interface SendSessionRecipient {
  id: string;
  originalRowNumber: number;
  firstName: string;
  firstNameForSms: string;
  lastName: string;
  mobileDisplay: string;
  mobileForCopy: string;
  renderedMessage: string;
  sendStatus: 'pending' | 'sent' | 'skipped';
  sentAt: string | null;
  skipReason: string | null;
  notes: string;
  patientPhoneInput?: string;
}

export interface SendLogEntry {
  id: string;
  timestamp: string;
  maskedPhone: string;
  templateLabel: string;
  status: 'sent' | 'failed';
}

export interface AppSettings {
  pharmacyName: string;
  pharmacyPhone: string;
  bookingLink: string;
  batchSoftCap: number;
  defaultOptOutText: string;
  suppressionList: { mobile: string; reason: string; addedAt: string }[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  pharmacyName: "Hugh's Pharmacy",
  pharmacyPhone: '',
  bookingLink: '',
  batchSoftCap: 50,
  defaultOptOutText: 'Reply STOP to opt out.',
  suppressionList: [],
};
