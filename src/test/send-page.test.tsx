import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SendPage from '@/pages/Send';
import { useAppStore } from '@/store/app-store';
import type { ImportedRecipient, SendSession } from '@/types';

const getActiveSessionMock = vi.fn();
const saveSessionMock = vi.fn();
const deleteSessionMock = vi.fn();

vi.mock('@/lib/persistence', () => ({
  getActiveSession: (...args: unknown[]) => getActiveSessionMock(...args),
  saveSession: (...args: unknown[]) => saveSessionMock(...args),
  deleteSession: (...args: unknown[]) => deleteSessionMock(...args),
}));

function makeRecipient(partial: Partial<ImportedRecipient> = {}): ImportedRecipient {
  return {
    id: partial.id ?? crypto.randomUUID(),
    originalRowNumber: partial.originalRowNumber ?? 4,
    firstName: partial.firstName ?? 'John',
    firstNameForSms: partial.firstNameForSms ?? 'John',
    lastName: partial.lastName ?? 'Smith',
    mobileRaw: partial.mobileRaw ?? '0412345678',
    mobileDisplay: partial.mobileDisplay ?? '0412 345 678',
    mobileForCopy: partial.mobileForCopy ?? '0412345678',
    isValidMobile: partial.isValidMobile ?? true,
    invalidReason: partial.invalidReason ?? null,
    isDuplicate: partial.isDuplicate ?? false,
    duplicateOfRow: partial.duplicateOfRow ?? null,
    isAlreadyTexted: partial.isAlreadyTexted ?? false,
    isSelected: partial.isSelected ?? true,
    isSuppressed: partial.isSuppressed ?? false,
  };
}

function makeSession(): SendSession {
  return {
    id: 'session-1',
    sourceFileName: 'patients.xlsx',
    messageBodySnapshot: 'Hi {firstName}',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'in_progress',
    currentIndex: 0,
    complianceAcknowledged: true,
    recipients: [
      {
        id: 'sr-1',
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
      },
      {
        id: 'sr-2',
        originalRowNumber: 5,
        firstName: 'Amy',
        firstNameForSms: 'Amy',
        lastName: 'Jones',
        mobileDisplay: '0411 000 000',
        mobileForCopy: '0411000000',
        renderedMessage: 'Hi Amy',
        sendStatus: 'pending',
        sentAt: null,
        skipReason: null,
        notes: '',
      },
    ],
  };
}

function renderSendPage() {
  return render(
    <MemoryRouter initialEntries={['/send']}>
      <Routes>
        <Route path="/send" element={<SendPage />} />
        <Route path="/review" element={<div>Review page</div>} />
        <Route path="/upload" element={<div>Upload page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SendPage', () => {
  beforeEach(() => {
    getActiveSessionMock.mockReset();
    saveSessionMock.mockReset();
    deleteSessionMock.mockReset();
    localStorage.clear();

    act(() => {
      useAppStore.setState({
        parseResult: null,
        originalFileBuffer: null,
        fileName: 'patients.xlsx',
        recipients: [makeRecipient({ id: 'r-1' }), makeRecipient({ id: 'r-2', firstName: 'Amy', firstNameForSms: 'Amy', lastName: 'Jones', originalRowNumber: 5, mobileDisplay: '0411 000 000', mobileForCopy: '0411000000' })],
        messageTemplate: 'Hi {firstName}',
        sessionName: 'patients',
        activeSession: null,
        settings: useAppStore.getState().settings,
        savedTemplates: [],
      });
    });
  });

  it('hydrates an active session from persistence on mount', async () => {
    const session = makeSession();
    getActiveSessionMock.mockResolvedValue(session);

    renderSendPage();

    expect(await screen.findByText(/Current patient/i)).toBeInTheDocument();
    expect(screen.getAllByText(/John Smith/).length).toBeGreaterThan(0);
    expect(useAppStore.getState().activeSession?.id).toBe('session-1');
  });

  it('marks the current patient sent and advances to the next patient', async () => {
    getActiveSessionMock.mockResolvedValue(makeSession());

    renderSendPage();
    await screen.findByText(/Current patient/i);

    fireEvent.click(screen.getByRole('button', { name: /Mark Sent & Next/i }));

    await waitFor(() => {
      const state = useAppStore.getState().activeSession;
      expect(state?.recipients[0].sendStatus).toBe('sent');
      expect(state?.recipients[0].sentAt).toBeTruthy();
      expect(state?.currentIndex).toBe(1);
    });
  });

  it('allows undoing the last action', async () => {
    getActiveSessionMock.mockResolvedValue(makeSession());

    renderSendPage();
    await screen.findByText(/Current patient/i);

    fireEvent.click(screen.getByRole('button', { name: /Mark Sent & Next/i }));
    await screen.findByRole('button', { name: /Undo Last/i });
    fireEvent.click(screen.getByRole('button', { name: /Undo Last/i }));

    await waitFor(() => {
      const state = useAppStore.getState().activeSession;
      expect(state?.recipients[0].sendStatus).toBe('pending');
      expect(state?.currentIndex).toBe(0);
    });
  });
});
