import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UploadPage from '@/pages/Upload';
import { useAppStore } from '@/store/app-store';
import type { SendSession } from '@/types';

const getActiveSessionMock = vi.fn();
const saveSessionMock = vi.fn();
const parseSpreadsheetMock = vi.fn();

vi.mock('@/lib/persistence', () => ({
  getActiveSession: (...args: unknown[]) => getActiveSessionMock(...args),
  saveSession: (...args: unknown[]) => saveSessionMock(...args),
}));

vi.mock('@/lib/spreadsheet', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spreadsheet')>('@/lib/spreadsheet');
  return {
    ...actual,
    parseSpreadsheet: (...args: unknown[]) => parseSpreadsheetMock(...args),
  };
});

function makeSession(): SendSession {
  return {
    id: 'session-1',
    sourceFileName: 'existing.xlsx',
    sourceFileNames: ['existing.xlsx'],
    messageBodySnapshot: 'Hi {firstName}',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'in_progress',
    currentIndex: 0,
    complianceAcknowledged: true,
    recipients: [
      {
        id: 'sr-1',
        sourceFileName: 'existing.xlsx',
        originalRowNumber: 4,
        firstName: 'John',
        firstNameForSms: 'John',
        lastName: 'Smith',
        mobileDisplay: '0412 345 678',
        mobileForCopy: '0412345678',
        renderedMessage: 'Hi John',
        sendStatus: 'pending',
        sentAt: null,
        skipReason: null,
        notes: '',
        patientPhoneInput: '0412 345 678',
      },
    ],
  };
}

describe('UploadPage append workflow', () => {
  beforeEach(() => {
    getActiveSessionMock.mockReset();
    saveSessionMock.mockReset();
    parseSpreadsheetMock.mockReset();

    localStorage.clear();

    useAppStore.setState({
      parseResult: null,
      originalFileBuffer: null,
      fileName: '',
      recipients: [],
      messageTemplate: 'Hi {firstName}',
      sessionName: '',
      activeSession: null,
      settings: useAppStore.getState().settings,
      savedTemplates: [],
    });
  });

  it('appends new uploaded recipients into the active queue', async () => {
    const existingSession = makeSession();
    getActiveSessionMock.mockResolvedValue(existingSession);
    parseSpreadsheetMock.mockReturnValue({
      template: 'Hi {firstName}',
      recipients: [
        {
          id: 'r-1',
          originalRowNumber: 4,
          firstName: 'Jane',
          firstNameForSms: 'Jane',
          lastName: 'Doe',
          mobileRaw: '0413000000',
          mobileDisplay: '0413 000 000',
          mobileForCopy: '0413000000',
          isValidMobile: true,
          invalidReason: null,
          isDuplicate: false,
          duplicateOfRow: null,
          isAlreadyTexted: false,
          isSelected: true,
          isSuppressed: false,
        },
      ],
      stats: { total: 1, valid: 1, alreadyTexted: 0, duplicates: 0, invalid: 0 },
      warnings: [],
    });

    const file = new File(['dummy'], 'new-list.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileReaderSpy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function () {
      Object.defineProperty(this, 'result', { value: new ArrayBuffer(8), configurable: true });
      this.onload?.({ target: this } as ProgressEvent<FileReader>);
    });

    render(
      <MemoryRouter initialEntries={['/upload']}>
        <Routes>
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/send" element={<div>Send page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const originalCreateElement = document.createElement.bind(document);
    const input = originalCreateElement('input');
    const clickSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'input') return input;
      return originalCreateElement(tagName);
    });

    fireEvent.click(screen.getByText(/Drop your patient spreadsheet here/i));
    Object.defineProperty(input, 'files', { value: [file] });
    input.onchange?.(new Event('change'));

    await waitFor(() => {
      expect(saveSessionMock).toHaveBeenCalledTimes(1);
      const savedSession = saveSessionMock.mock.calls[0][0] as SendSession;
      expect(savedSession.recipients).toHaveLength(2);
      expect(savedSession.recipients[1].firstName).toBe('Jane');
      expect(savedSession.sourceFileNames).toContain('new-list.xlsx');
    });

    clickSpy.mockRestore();
    fileReaderSpy.mockRestore();
  });
});
