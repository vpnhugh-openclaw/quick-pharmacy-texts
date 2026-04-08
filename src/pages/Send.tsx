import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clipboard,
  Check,
  SkipForward,
  Undo2,
  Pause,
  ArrowLeft,
  ArrowRight,
  UserRound,
  AlertCircle,
  RotateCcw,
  Filter,
  SendHorizontal,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/app-store';
import { renderMessage, generateId } from '@/lib/sms-utils';
import { deleteSession, getActiveSession, saveSession } from '@/lib/persistence';
import { isValidAUMobile, sendSMS, toE164AU } from '@/services/httpsms';
import type { SendLogEntry, SendSession, SendSessionRecipient } from '@/types';

interface LastActionState {
  recipientIndex: number;
  previousRecipient: SendSessionRecipient;
  previousCurrentIndex: number;
  previousStatus: SendSession['status'];
}

interface SendState {
  status: 'idle' | 'sending' | 'sent';
  recipientId: string | null;
}

type QueueFilter = 'all' | 'pending' | 'skipped';

const HTTPSMS_API_KEY_STORAGE = 'httpsms_api_key';
const HTTPSMS_FROM_NUMBER_STORAGE = 'httpsms_from_number';

export default function SendPage() {
  const navigate = useNavigate();
  const { recipients, messageTemplate, settings, activeSession, setActiveSession } = useAppStore();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<'number' | 'message' | null>(null);
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [note, setNote] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [lastAction, setLastAction] = useState<LastActionState | null>(null);
  const [sendState, setSendState] = useState<SendState>({ status: 'idle', recipientId: null });
  const [sendLog, setSendLog] = useState<SendLogEntry[]>([]);
  const [showSendLog, setShowSendLog] = useState(false);
  const instructionsDismissed = localStorage.getItem('hughs-instructions-dismissed') === 'true';
  const [showInstructions, setShowInstructions] = useState(!instructionsDismissed);

  useEffect(() => {
    let cancelled = false;

    const initialiseSession = async () => {
      if (activeSession) {
        setIsHydrating(false);
        return;
      }

      const persisted = await getActiveSession();
      if (cancelled) return;

      if (persisted) {
        setActiveSession(persisted);
        setIsHydrating(false);
        return;
      }

      const selected = recipients.filter((r) => r.isSelected);
      if (selected.length === 0) {
        setIsHydrating(false);
        navigate('/review');
        return;
      }

      const sessionRecipients: SendSessionRecipient[] = selected.map((r) => ({
        id: generateId(),
        sourceFileName: useAppStore.getState().fileName,
        originalRowNumber: r.originalRowNumber,
        firstName: r.firstName,
        firstNameForSms: r.firstNameForSms,
        lastName: r.lastName,
        mobileDisplay: r.mobileDisplay,
        mobileForCopy: r.mobileForCopy,
        renderedMessage: renderMessage(messageTemplate, r, settings),
        sendStatus: 'pending',
        sentAt: null,
        skipReason: null,
        notes: '',
        patientPhoneInput: r.mobileDisplay,
      }));

      const session: SendSession = {
        id: generateId(),
        sourceFileName: useAppStore.getState().fileName,
        sourceFileNames: [useAppStore.getState().fileName],
        messageBodySnapshot: messageTemplate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'in_progress',
        currentIndex: 0,
        complianceAcknowledged: false,
        recipients: sessionRecipients,
      };

      setActiveSession(session);
      await saveSession(session);
      if (!cancelled) setIsHydrating(false);
    };

    void initialiseSession();

    return () => {
      cancelled = true;
    };
  }, [activeSession, recipients, messageTemplate, settings, navigate, setActiveSession]);

  const session = activeSession;

  const updateSession = useCallback(
    async (updates: Partial<SendSession>) => {
      if (!session) return null;
      const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
      setActiveSession(updated);
      await saveSession(updated);
      return updated;
    },
    [session, setActiveSession]
  );

  const updateRecipients = useCallback(
    async (recipientsUpdate: SendSessionRecipient[], extraUpdates: Partial<SendSession> = {}) => {
      return updateSession({ recipients: recipientsUpdate, ...extraUpdates });
    },
    [updateSession]
  );

  const getNextPendingIndex = useCallback((recipientsList: SendSessionRecipient[], currentIndex: number) => {
    const nextIndex = recipientsList.findIndex((r, i) => i > currentIndex && r.sendStatus === 'pending');
    if (nextIndex >= 0) return nextIndex;
    return recipientsList.findIndex((r) => r.sendStatus === 'pending');
  }, []);

  const resetInlineState = () => {
    setShowSkipInput(false);
    setSkipReason('');
    setNote('');
  };

  const updateCurrentPatientState = useCallback(
    async (nextStatus: 'sent' | 'skipped') => {
      if (!session) return;

      const currentRecipient = session.recipients[session.currentIndex];
      if (!currentRecipient || currentRecipient.sendStatus !== 'pending') return;

      const nextRecipients = [...session.recipients];
      setLastAction({
        recipientIndex: session.currentIndex,
        previousRecipient: currentRecipient,
        previousCurrentIndex: session.currentIndex,
        previousStatus: session.status,
      });

      nextRecipients[session.currentIndex] = {
        ...currentRecipient,
        notes: note || currentRecipient.notes,
        sendStatus: nextStatus,
        sentAt: nextStatus === 'sent' ? currentRecipient.sentAt || new Date().toISOString() : null,
        skipReason: nextStatus === 'skipped' ? skipReason || currentRecipient.skipReason : null,
      };

      const nextPendingIndex = getNextPendingIndex(nextRecipients, session.currentIndex);
      const status = nextPendingIndex === -1 ? 'completed' : session.status === 'paused' ? 'in_progress' : session.status;

      await updateRecipients(nextRecipients, {
        currentIndex: nextPendingIndex === -1 ? session.currentIndex : nextPendingIndex,
        status,
      });

      resetInlineState();
    },
    [session, note, skipReason, getNextPendingIndex, updateRecipients]
  );

  const markCurrentPatientSent = useCallback(async () => updateCurrentPatientState('sent'), [updateCurrentPatientState]);
  const markCurrentPatientSkipped = useCallback(async () => updateCurrentPatientState('skipped'), [updateCurrentPatientState]);

  const navigateToRecipient = useCallback(
    async (index: number) => {
      if (!session || index < 0 || index >= session.recipients.length) return;
      await updateSession({ currentIndex: index, status: session.status === 'paused' ? 'in_progress' : session.status });
      resetInlineState();
    },
    [session, updateSession]
  );

  const goToPreviousRecipient = useCallback(async () => {
    if (!session) return;
    await navigateToRecipient(Math.max(0, session.currentIndex - 1));
  }, [session, navigateToRecipient]);

  const goToNextRecipient = useCallback(async () => {
    if (!session) return;
    const nextIndex = Math.min(session.recipients.length - 1, session.currentIndex + 1);
    await navigateToRecipient(nextIndex);
  }, [session, navigateToRecipient]);

  const undoLastAction = useCallback(async () => {
    if (!session || !lastAction) return;

    const nextRecipients = [...session.recipients];
    nextRecipients[lastAction.recipientIndex] = lastAction.previousRecipient;

    await updateRecipients(nextRecipients, {
      currentIndex: lastAction.previousCurrentIndex,
      status: lastAction.previousStatus === 'completed' ? 'in_progress' : lastAction.previousStatus,
    });

    setLastAction(null);
    setShowSessionSummary(false);
  }, [session, lastAction, updateRecipients]);

  const restartSession = useCallback(async () => {
    if (!session) return;
    const confirmed = window.confirm('Clear sent and skipped statuses and restart this session?');
    if (!confirmed) return;

    const resetRecipients = session.recipients.map((recipient) => ({
      ...recipient,
      sendStatus: 'pending' as const,
      sentAt: null,
      skipReason: null,
      notes: '',
      patientPhoneInput: recipient.mobileDisplay,
    }));

    setLastAction(null);
    setShowSessionSummary(false);
    setSendLog([]);
    await updateRecipients(resetRecipients, { currentIndex: 0, status: 'in_progress' });
  }, [session, updateRecipients]);

  const clearCurrentQueue = useCallback(async () => {
    if (!session) return;

    const label = queueFilter === 'all' ? 'entire queue' : queueFilter === 'pending' ? 'pending queue' : 'skipped queue';
    const confirmed = window.confirm(`Clear the ${label} and reset those patients back to pending?`);
    if (!confirmed) return;

    const resetRecipients = session.recipients.map((recipient) => {
      const matchesFilter = queueFilter === 'all'
        ? true
        : queueFilter === 'pending'
          ? recipient.sendStatus === 'pending'
          : recipient.sendStatus === 'skipped';

      if (!matchesFilter) return recipient;

      return {
        ...recipient,
        sendStatus: 'pending' as const,
        sentAt: null,
        skipReason: null,
        notes: '',
        patientPhoneInput: recipient.mobileDisplay,
      };
    });

    const nextCurrentIndex = resetRecipients.findIndex((recipient) => recipient.sendStatus === 'pending');

    setLastAction(null);
    setShowSessionSummary(false);
    await updateRecipients(resetRecipients, {
      currentIndex: nextCurrentIndex >= 0 ? nextCurrentIndex : 0,
      status: 'in_progress',
    });
  }, [session, queueFilter, updateRecipients]);

  const finishAndReturnToUpload = useCallback(async () => {
    if (!session) return;
    await deleteSession(session.id);
    setActiveSession(null);
    navigate('/upload');
  }, [session, setActiveSession, navigate]);

  const actionsRef = useRef<{
    markSent: () => void;
    markSkipped: () => void;
    copyNumber: () => void;
    copyMessage: () => void;
    previous: () => void;
    next: () => void;
    undo: () => void;
  } | null>(null);

  useEffect(() => {
    if (!session || session.status === 'completed') return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (fallbackText) {
          setFallbackText(null);
          return;
        }
        if (showSkipInput) {
          setShowSkipInput(false);
          setSkipReason('');
          return;
        }
        return;
      }

      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!actionsRef.current) return;

      const currentR = session.recipients[session.currentIndex];
      if (!currentR) return;

      if (e.key === 'Enter' && session.complianceAcknowledged && currentR.sendStatus === 'pending') {
        e.preventDefault();
        actionsRef.current.markSent();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (currentR.sendStatus !== 'pending') return;
        if (showSkipInput) {
          actionsRef.current.markSkipped();
        } else {
          setShowSkipInput(true);
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        actionsRef.current.copyNumber();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        actionsRef.current.copyMessage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        actionsRef.current.previous();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        actionsRef.current.next();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        actionsRef.current.undo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session, showSkipInput, fallbackText]);

  if (isHydrating) {
    return <div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">Restoring your send session…</div>;
  }

  if (!session) return null;

  const currentRecipient = session.recipients[session.currentIndex];
  const sentCount = session.recipients.filter((r) => r.sendStatus === 'sent').length;
  const skippedCount = session.recipients.filter((r) => r.sendStatus === 'skipped').length;
  const pendingCount = session.recipients.filter((r) => r.sendStatus === 'pending').length;
  const processedCount = sentCount + skippedCount;
  const totalCount = session.recipients.length;
  const isComplete = pendingCount === 0 || session.status === 'completed';
  const filteredRecipients = session.recipients.filter((recipient) => {
    if (queueFilter === 'pending') return recipient.sendStatus === 'pending';
    if (queueFilter === 'skipped') return recipient.sendStatus === 'skipped';
    return true;
  });
  const httpSmsConfigured = Boolean(localStorage.getItem(HTTPSMS_API_KEY_STORAGE) && localStorage.getItem(HTTPSMS_FROM_NUMBER_STORAGE));
  const currentPatientPhone = currentRecipient?.patientPhoneInput || currentRecipient?.mobileDisplay || '';
  const currentPatientPhoneValid = isValidAUMobile(toE164AU(currentPatientPhone));

  const copyToClipboard = async (text: string, field: 'number' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setFallbackText(text);
    }
  };

  const pauseSession = async () => {
    await updateSession({ status: 'paused' });
    navigate('/upload');
  };

  const updateCurrentRecipient = async (updates: Partial<SendSessionRecipient>) => {
    if (!currentRecipient) return;
    const nextRecipients = [...session.recipients];
    nextRecipients[session.currentIndex] = { ...currentRecipient, ...updates };
    await updateRecipients(nextRecipients);
  };

  const handlePatientPhoneBlur = async () => {
    if (!currentRecipient) return;
    const normalised = toE164AU(currentPatientPhone);
    if (!isValidAUMobile(normalised)) return;
    const localDisplay = `0${normalised.slice(3)}`.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    await updateCurrentRecipient({ patientPhoneInput: localDisplay });
  };

  const appendSendLog = (entry: Omit<SendLogEntry, 'id'>) => {
    setSendLog((current) => [{ id: generateId(), ...entry }, ...current]);
  };

  const handleSendSms = async () => {
    if (!currentRecipient || !httpSmsConfigured) return;

    const apiKey = localStorage.getItem(HTTPSMS_API_KEY_STORAGE) ?? '';
    const from = localStorage.getItem(HTTPSMS_FROM_NUMBER_STORAGE) ?? '';
    const to = toE164AU(currentPatientPhone);

    if (!currentPatientPhoneValid) {
      toast({
        title: 'SMS not sent',
        description: 'Please enter a valid Australian mobile number',
        variant: 'destructive',
      });
      return;
    }

    setSendState({ status: 'sending', recipientId: currentRecipient.id });
    const result = await sendSMS({
      apiKey,
      from,
      to,
      content: currentRecipient.renderedMessage,
    });

    if (!result.success) {
      toast({ title: 'SMS not sent', description: (result as { success: false; error: string }).error, variant: 'destructive' });
      appendSendLog({
        timestamp: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
        maskedPhone: `••••${to.slice(-4)}`,
        templateLabel: session.sourceFileName.replace(/\.xlsx$/i, ''),
        status: 'failed',
      });
      setSendState({ status: 'idle', recipientId: null });
      return;
    }

    appendSendLog({
      timestamp: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      maskedPhone: `••••${to.slice(-4)}`,
      templateLabel: session.sourceFileName.replace(/\.xlsx$/i, ''),
      status: 'sent',
    });
    setShowSendLog(true);
    setSendState({ status: 'sent', recipientId: currentRecipient.id });
    window.setTimeout(() => setSendState({ status: 'idle', recipientId: null }), 2500);
  };

  actionsRef.current = {
    markSent: () => void markCurrentPatientSent(),
    markSkipped: () => void markCurrentPatientSkipped(),
    copyNumber: () => currentRecipient && void copyToClipboard(currentRecipient.mobileForCopy, 'number'),
    copyMessage: () => currentRecipient && void copyToClipboard(currentRecipient.renderedMessage, 'message'),
    previous: () => void goToPreviousRecipient(),
    next: () => void goToNextRecipient(),
    undo: () => void undoLastAction(),
  };

  if (isComplete || showSessionSummary) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 py-12">
        <section className="text-center">
          <p className="frost-pill text-[#11ff99]">Session summary</p>
          <h1 className="mt-4">{isComplete ? 'Session complete.' : 'Session snapshot.'}</h1>
          <p className="mt-4 text-muted-foreground">{sentCount} sent · {skippedCount} skipped · {pendingCount} pending</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryStat label="Sent" value={sentCount} className="text-[#11ff99]" />
          <SummaryStat label="Skipped" value={skippedCount} className="text-[#ffc53d]" />
          <SummaryStat label="Pending" value={pendingCount} className="text-muted-foreground" />
        </div>

        {skippedCount > 0 && (
          <div className="frost-panel border-[#ffc53d]/20 bg-[#ffc53d]/5 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3>Skipped patients</h3>
                <p className="mt-1 text-sm text-muted-foreground">Review and return to these patients if needed.</p>
              </div>
              <Button variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => { setQueueFilter('skipped'); setShowSessionSummary(false); }}>
                <Filter className="mr-2 h-4 w-4" /> Review skipped
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {lastAction && (
            <Button variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void undoLastAction()}>
              <Undo2 className="mr-2 h-4 w-4" /> Undo last
            </Button>
          )}
          {pendingCount > 0 && (
            <Button variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setShowSessionSummary(false)}>
              Return to session
            </Button>
          )}
          <Button variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void restartSession()}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restart session
          </Button>
          <Button className="rounded-full" onClick={() => navigate('/results')}>View full results</Button>
          <Button variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void finishAndReturnToUpload()}>
            Send another batch
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-40">
      <section className="max-w-4xl space-y-4">
        <p className="frost-pill text-[#ffa057]">Send workflow</p>
        <h1>Move through each patient with a clean queue and direct send controls.</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Copy manually into Messages or send directly through httpSMS, then keep the session state accurate as you go.
        </p>
      </section>

      {showInstructions && (
        <div data-testid="send-instructions" className="frost-panel border-[#3b9eff]/20 bg-[#3b9eff]/5 p-5 text-sm">
          <p className="font-medium text-foreground">How to send each message</p>
          <p className="mt-2 text-muted-foreground">Keep this tab open alongside <strong>messages.google.com</strong> in another tab.</p>
          <ol className="mt-3 ml-4 list-decimal space-y-1 text-muted-foreground">
            <li>Tap <strong>Copy Number</strong>, switch to Messages, paste into “To:”, then press Enter.</li>
            <li>Tap <strong>Copy Message</strong>, paste into the message field, then send.</li>
            <li>Return here and tap <strong>Mark Sent & Next</strong>.</li>
          </ol>
          <button
            className="mt-4 text-sm font-medium text-[#3b9eff] hover:underline"
            onClick={() => {
              setShowInstructions(false);
              localStorage.setItem('hughs-instructions-dismissed', 'true');
            }}
          >
            Got it, don&apos;t show again
          </button>
        </div>
      )}

      <div data-testid="send-progress-panel" data-compliance-acknowledged={session.complianceAcknowledged ? 'true' : 'false'} className="frost-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{processedCount} of {totalCount} patients processed</p>
            <p className="text-sm text-muted-foreground">{sentCount} sent · {skippedCount} skipped · {pendingCount} pending</p>
          </div>
          <div className="frost-pill text-muted-foreground">Patient {session.currentIndex + 1} of {totalCount}</div>
        </div>

        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-[#11ff99] transition-all" style={{ width: `${(sentCount / totalCount) * 100}%` }} />
          <div className="h-full bg-[#ffc53d] transition-all" style={{ width: `${(skippedCount / totalCount) * 100}%` }} />
          <div className="h-full bg-white/15 transition-all" style={{ width: `${(pendingCount / totalCount) * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {currentRecipient && (
            <div data-testid="send-current-patient" className="frost-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3b9eff]">Current patient</p>
                  <p className="mt-2 text-xs text-muted-foreground">Row {currentRecipient.originalRowNumber}</p>
                  <h2 className="mt-2">{currentRecipient.firstName} {currentRecipient.lastName}</h2>
                  <p className="mt-2 font-mono text-muted-foreground">{currentRecipient.mobileDisplay}</p>
                </div>
                <div
                  className={`frost-pill ${
                    currentRecipient.sendStatus === 'pending'
                      ? 'text-muted-foreground'
                      : currentRecipient.sendStatus === 'sent'
                        ? 'bg-[#11ff99]/10 text-[#11ff99]'
                        : 'bg-[#ffc53d]/10 text-[#ffc53d]'
                  }`}
                >
                  {currentRecipient.sendStatus === 'pending' ? 'Pending' : currentRecipient.sendStatus === 'sent' ? 'Sent' : 'Skipped'}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Message preview</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{currentRecipient.renderedMessage}</p>
              </div>

              <div className="mt-5 space-y-2">
                <label className="block text-sm font-medium">Patient Mobile Number</label>
                <Input
                  data-testid="send-patient-phone-input"
                  type="tel"
                  value={currentPatientPhone}
                  placeholder="e.g. 0412 345 678"
                  className={!currentPatientPhoneValid ? 'border-[#ff2047] focus-visible:ring-[#ff2047]' : ''}
                  onChange={(e) => void updateCurrentRecipient({ patientPhoneInput: e.target.value })}
                  onBlur={() => void handlePatientPhoneBlur()}
                />
                {!currentPatientPhoneValid && <p className="text-sm text-[#ff8aa0]">Please enter a valid Australian mobile number</p>}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button data-testid="send-copy-number" className="h-[52px] rounded-full text-base" onClick={() => copyToClipboard(currentRecipient.mobileForCopy, 'number')}>
                  {copiedField === 'number' ? <><Check className="mr-2 h-5 w-5" /> Copied!</> : <><Clipboard className="mr-2 h-5 w-5" /> Copy Number</>}
                </Button>
                <Button data-testid="send-copy-message" className="h-[52px] rounded-full text-base" onClick={() => copyToClipboard(currentRecipient.renderedMessage, 'message')}>
                  {copiedField === 'message' ? <><Check className="mr-2 h-5 w-5" /> Copied!</> : <><Clipboard className="mr-2 h-5 w-5" /> Copy Message</>}
                </Button>
              </div>

              <div className="mt-3">
                <Button
                  data-testid="send-sms-button"
                  aria-label="Send SMS Directly"
                  variant="secondary"
                  className={`h-[48px] w-full rounded-full border text-base font-medium ${sendState.status === 'sending' || !httpSmsConfigured ? 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/5' : 'border-[#16a34a] bg-[#16a34a] text-white hover:bg-[#15803d]'}`}
                  onClick={() => void handleSendSms()}
                  disabled={sendState.status === 'sending' || !httpSmsConfigured}
                  title={!httpSmsConfigured ? 'Configure httpSMS in Settings first' : undefined}
                >
                  {sendState.status === 'sending' && sendState.recipientId === currentRecipient.id ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                  ) : sendState.status === 'sent' && sendState.recipientId === currentRecipient.id ? (
                    <><Check className="mr-2 h-4 w-4" /> ✓ Sent!</>
                  ) : (
                    <><SendHorizontal className="mr-2 h-4 w-4" /> Send SMS Directly</>
                  )}
                </Button>
              </div>

              <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                {!session.complianceAcknowledged && (
                  <label data-testid="send-compliance-label" className="flex cursor-pointer items-start gap-2 rounded-2xl border border-[#ffc53d]/30 bg-[#ffc53d]/5 p-4 text-sm">
                    <Checkbox
                      data-testid="send-compliance-checkbox"
                      className="mt-0.5"
                      onCheckedChange={(v) => {
                        if (v) void updateSession({ complianceAcknowledged: true, status: session.status === 'paused' ? 'in_progress' : session.status });
                      }}
                    />
                    I confirm these patients have an existing relationship with this pharmacy.
                  </label>
                )}

                <Input data-testid="send-note-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

                {showSkipInput && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input data-testid="send-skip-reason-input" placeholder="Reason for skip (optional)" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="sm:max-w-xs" />
                    <Button data-testid="send-confirm-skip" variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void markCurrentPatientSkipped()}>
                      Confirm Skip
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowSkipInput(false); setSkipReason(''); }}>
                      Keep Pending
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div data-testid="send-queue-panel" className="frost-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3>Queue</h3>
            <select
              data-testid="send-queue-filter"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground outline-none"
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value as QueueFilter)}
            >
              <option value="all">All patients</option>
              <option value="pending">Pending only</option>
              <option value="skipped">Skipped only</option>
            </select>
          </div>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {filteredRecipients.map((recipient) => {
              const realIdx = session.recipients.indexOf(recipient);
              const isCurrent = realIdx === session.currentIndex;
              return (
                <button
                  data-testid="send-queue-item"
                  key={recipient.id}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                    isCurrent
                      ? 'border-white/20 bg-white text-black'
                      : recipient.sendStatus === 'sent'
                        ? 'border-[#11ff99]/20 bg-[#11ff99]/5 text-foreground/80'
                        : recipient.sendStatus === 'skipped'
                          ? 'border-[#ffc53d]/20 bg-[#ffc53d]/5 text-foreground/85'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                  onClick={() => void navigateToRecipient(realIdx)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-medium ${recipient.sendStatus === 'sent' ? 'line-through' : ''}`}>
                      {recipient.firstName} {recipient.lastName}
                    </span>
                    <span className="text-xs">
                      {recipient.sendStatus === 'sent' && <span className="text-[#11ff99]">✓ Sent</span>}
                      {recipient.sendStatus === 'skipped' && <span className="text-[#ffc53d]">Skipped</span>}
                      {recipient.sendStatus === 'pending' && <span className="text-muted-foreground">Pending</span>}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRound className="h-3 w-3" /> Row {recipient.originalRowNumber}
                  </div>
                </button>
              );
            })}
            {filteredRecipients.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">No patients match this filter.</div>}
          </div>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <Button data-testid="send-clear-queue" variant="outline" size="sm" className="w-full rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void clearCurrentQueue()}>
              <RotateCcw className="mr-1 h-3 w-3" /> Clear current queue
            </Button>
            <Button data-testid="send-view-summary" variant="outline" size="sm" className="w-full rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setShowSessionSummary(true)}>
              View session summary
            </Button>
            <Button data-testid="send-pause-save" variant="outline" size="sm" className="w-full rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void pauseSession()}>
              <Pause className="mr-1 h-3 w-3" /> Pause & save
            </Button>
          </div>
        </div>
      </div>

      {sendLog.length > 0 && (
        <div className="frost-panel mt-6">
          <button type="button" className="flex w-full items-center justify-between px-4 py-4 text-left" onClick={() => setShowSendLog((value) => !value)}>
            <span className="text-sm font-medium">Today&apos;s Sends ({sendLog.filter((entry) => entry.status === 'sent').length})</span>
            {showSendLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showSendLog && (
            <div className="border-t border-white/10 px-4 py-4">
              <div className="space-y-2 text-sm">
                {sendLog.map((entry) => (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
                    <span className="text-muted-foreground">{entry.timestamp}</span>
                    <span>{entry.maskedPhone}</span>
                    <span className="text-muted-foreground">{entry.templateLabel}</span>
                    <span className={entry.status === 'sent' ? 'text-[#11ff99]' : 'text-[#ff8aa0]'}>{entry.status === 'sent' ? 'Sent ✓' : 'Failed ✗'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div data-testid="send-bottom-bar" className="fixed inset-x-0 bottom-0 z-40 bg-[#1d4ed8] shadow-[0_-2px_8px_rgba(0,0,0,0.15)] backdrop-blur-xl">
        <div className="section-shell flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              Patient {session.currentIndex + 1} of {totalCount} , {currentRecipient?.firstName} {currentRecipient?.lastName}
            </p>
            <p className="text-xs text-[#bfdbfe]">Enter = sent, S = skip, Z = undo, ←/→ = move, N = copy number, M = copy message</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-full border-white/20 bg-white/10 text-[#bfdbfe] hover:bg-white/20 hover:text-white" onClick={() => void goToPreviousRecipient()} disabled={session.currentIndex === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            {!showSkipInput ? (
              <Button data-testid="send-skip-button" variant="outline" className="rounded-full border-white/20 bg-white/10 text-[#bfdbfe] hover:bg-white/20 hover:text-white" onClick={() => setShowSkipInput(true)} disabled={!currentRecipient || currentRecipient.sendStatus !== 'pending'}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full border-white/20 bg-white/10 text-[#bfdbfe] hover:bg-white/20 hover:text-white" onClick={() => { setShowSkipInput(false); setSkipReason(''); }}>
                <Undo2 className="mr-1 h-4 w-4" /> Keep Pending
              </Button>
            )}
            {lastAction && (
              <Button variant="outline" className="rounded-full border-white/20 bg-white/10 text-[#bfdbfe] hover:bg-white/20 hover:text-white" onClick={() => void undoLastAction()}>
                <Undo2 className="mr-1 h-4 w-4" /> Undo Last
              </Button>
            )}
            <Button data-testid="send-mark-sent-next" className="rounded-full bg-white text-[#1d4ed8] hover:bg-white/90" onClick={() => void markCurrentPatientSent()} disabled={!session.complianceAcknowledged || !currentRecipient || currentRecipient.sendStatus !== 'pending'}>
              <Check className="mr-1 h-4 w-4" /> Mark Sent & Next
            </Button>
            <Button variant="outline" className="rounded-full border-white/20 bg-white/10 text-[#bfdbfe] hover:bg-white/20 hover:text-white" onClick={() => void goToNextRecipient()} disabled={session.currentIndex >= totalCount - 1}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {fallbackText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-black p-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" /> Copy this text manually
            </div>
            <textarea
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm font-mono text-foreground"
              rows={4}
              value={fallbackText}
              readOnly
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <Button className="w-full rounded-full" onClick={() => setFallbackText(null)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="frost-panel p-5 text-center">
      <p className={`text-4xl font-semibold ${className}`}>{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    </div>
  );
}
