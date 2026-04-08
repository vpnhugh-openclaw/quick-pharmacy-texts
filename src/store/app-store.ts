import { create } from 'zustand';
import type { ImportedRecipient, AppSettings, SendSession, MessageTemplate } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import type { ParseResult } from '@/lib/spreadsheet';

interface AppState {
  // Import state
  parseResult: ParseResult | null;
  originalFileBuffer: ArrayBuffer | null;
  fileName: string;
  setParseResult: (result: ParseResult, buffer: ArrayBuffer, fileName: string) => void;

  // Recipients
  recipients: ImportedRecipient[];
  setRecipients: (r: ImportedRecipient[]) => void;
  toggleRecipient: (id: string) => void;
  selectFirst: (n: number) => void;
  selectAllValid: () => void;
  clearSelection: () => void;

  // Message
  messageTemplate: string;
  sessionName: string;
  setMessageTemplate: (t: string) => void;
  setSessionName: (n: string) => void;

  // Session
  activeSession: SendSession | null;
  setActiveSession: (s: SendSession | null) => void;
  restoreSessionContext: (session: SendSession) => void;

  // Settings
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;

  // Templates
  savedTemplates: MessageTemplate[];
  setSavedTemplates: (t: MessageTemplate[]) => void;

  // Reset
  resetImport: () => void;
}

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('hughs-settings');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

function loadTemplates(): MessageTemplate[] {
  try {
    const stored = localStorage.getItem('hughs-templates');
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export const useAppStore = create<AppState>((set, get) => ({
  parseResult: null,
  originalFileBuffer: null,
  fileName: '',
  setParseResult: (result, buffer, fileName) => set({
    parseResult: result,
    originalFileBuffer: buffer,
    fileName,
    recipients: result.recipients,
    messageTemplate: result.template,
    sessionName: `${fileName.replace(/\.xlsx$/i, '')} — ${new Date().toLocaleDateString('en-AU')}`,
  }),

  recipients: [],
  setRecipients: (r) => set({ recipients: r }),
  toggleRecipient: (id) => set(state => ({
    recipients: state.recipients.map(r => r.id === id ? { ...r, isSelected: !r.isSelected } : r)
  })),
  selectFirst: (n) => set(state => {
    let count = 0;
    return {
      recipients: state.recipients.map(r => {
        if (r.isValidMobile && !r.isAlreadyTexted && !r.isSuppressed && count < n) {
          count++;
          return { ...r, isSelected: true };
        }
        return { ...r, isSelected: false };
      })
    };
  }),
  selectAllValid: () => set(state => ({
    recipients: state.recipients.map(r => ({
      ...r,
      isSelected: r.isValidMobile && !r.isAlreadyTexted && !r.isSuppressed
    }))
  })),
  clearSelection: () => set(state => ({
    recipients: state.recipients.map(r => ({ ...r, isSelected: false }))
  })),

  messageTemplate: '',
  sessionName: '',
  setMessageTemplate: (t) => set({ messageTemplate: t }),
  setSessionName: (n) => set({ sessionName: n }),

  activeSession: null,
  setActiveSession: (s) => set({ activeSession: s }),
  restoreSessionContext: (session) => set({
    activeSession: session,
    fileName: session.sourceFileName,
    messageTemplate: session.messageBodySnapshot,
    sessionName: session.sourceFileName.replace(/\.xlsx$/i, ''),
  }),

  settings: loadSettings(),
  setSettings: (s) => {
    localStorage.setItem('hughs-settings', JSON.stringify(s));
    set({ settings: s });
  },

  savedTemplates: loadTemplates(),
  setSavedTemplates: (t) => {
    localStorage.setItem('hughs-templates', JSON.stringify(t));
    set({ savedTemplates: t });
  },

  resetImport: () => set({
    parseResult: null,
    originalFileBuffer: null,
    fileName: '',
    recipients: [],
    messageTemplate: '',
    sessionName: '',
  }),
}));
