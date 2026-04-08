import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clipboard, Check, SkipForward, Undo2, Pause, ArrowLeft, ArrowRight, UserRound, AlertCircle, RotateCcw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { renderMessage, generateId } from '@/lib/sms-utils';
import { deleteSession, getActiveSession, saveSession } from '@/lib/persistence';
import type { SendSession, SendSessionRecipient } from '@/types';

interface LastActionState {
  recipientIndex: number;
  previousRecipient: SendSessionRecipient;
  previousCurrentIndex: number;
  previousStatus: SendSession['status'];
}

type QueueFilter = 'all' | 'pending' | 'skipped';

export default function SendPage() {
  const navigate = useNavigate();
  const { recipients, messageTemplate, settings, activeSession, setActiveSession } = useAppStore();
  const [copiedField, setCopiedField] = useState<'number' | 'message' | null>(null);
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [note, setNote] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [lastAction, setLastAction] = useState<LastActionState | null>(null);
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
      }));

      const session: SendSession = {
        id: generateId(),
        sourceFileName: useAppStore.getState().fileName,
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
    }));

    setLastAction(null);
    setShowSessionSummary(false);
    await updateRecipients(resetRecipients, { currentIndex: 0, status: 'in_progress' });
  }, [session, updateRecipients]);

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
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-muted-foreground">
        Restoring your send session…
      </div>
    );
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
      <div className="mx-auto max-w-3xl space-y-6 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="mb-2 text-2xl font-medium">{isComplete ? 'Session complete' : 'Session summary'}</h2>
          <p className="text-muted-foreground">{sentCount} sent · {skippedCount} skipped · {pendingCount} pending</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryStat label="Sent" value={sentCount} className="text-success" />
          <SummaryStat label="Skipped" value={skippedCount} className="text-warning" />
          <SummaryStat label="Pending" value={pendingCount} className="text-muted-foreground" />
        </div>

        {skippedCount > 0 && (
          <div className="rounded-2xl border border-warning/20 bg-warning/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-foreground">Skipped patients</h3>
                <p className="text-sm text-muted-foreground">Review and return to these patients if needed.</p>
              </div>
              <Button variant="outline" onClick={() => { setQueueFilter('skipped'); setShowSessionSummary(false); }}>
                <Filter className="mr-1 h-4 w-4" /> Review skipped
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {lastAction && (
            <Button variant="outline" onClick={() => void undoLastAction()}>
              <Undo2 className="mr-1 h-4 w-4" /> Undo last
            </Button>
          )}
          {pendingCount > 0 && (
            <Button variant="outline" onClick={() => setShowSessionSummary(false)}>
              Return to session
            </Button>
          )}
          <Button variant="outline" onClick={() => void restartSession()}>
            <RotateCcw className="mr-1 h-4 w-4" /> Restart session
          </Button>
          <Button onClick={() => navigate('/results')}>View full results</Button>
          <Button variant="outline" onClick={() => void finishAndReturnToUpload()}>
            Send another batch
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-44">
      {showInstructions && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="mb-2 font-medium">How to send each message:</p>
          <p className="text-muted-foreground">Keep this tab open alongside <strong>messages.google.com</strong> in another tab.</p>
          <ol className="mt-2 ml-4 list-decimal space-y-1 text-muted-foreground">
            <li>Tap <strong>Copy Number</strong> → switch to Messages tab → paste into "To:" → Enter</li>
            <li>Tap <strong>Copy Message</strong> → switch to Messages tab → paste into message field → Send</li>
            <li>Return here → tap <strong>Mark Sent & Next</strong></li>
          </ol>
          <button
            className="mt-3 text-sm font-medium text-primary hover:underline"
            onClick={() => {
              setShowInstructions(false);
              localStorage.setItem('hughs-instructions-dismissed', 'true');
            }}
          >
            Got it — don't show again
          </button>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{processedCount} of {totalCount} patients processed</p>
            <p className="text-sm text-muted-foreground">{sentCount} sent · {skippedCount} skipped · {pendingCount} pending</p>
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            Patient {session.currentIndex + 1} of {totalCount}
          </div>
        </div>

        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-success transition-all" style={{ width: `${(sentCount / totalCount) * 100}%` }} />
          <div className="h-full bg-warning transition-all" style={{ width: `${(skippedCount / totalCount) * 100}%` }} />
          <div className="h-full bg-muted transition-all" style={{ width: `${(pendingCount / totalCount) * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {currentRecipient && (
            <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Current patient</p>
                  <p className="mt-1 text-xs text-muted-foreground">Row {currentRecipient.originalRowNumber}</p>
                  <h2 className="text-2xl font-medium">{currentRecipient.firstName} {currentRecipient.lastName}</h2>
                  <p className="font-mono text-muted-foreground">{currentRecipient.mobileDisplay}</p>
                </div>
                <div className={`rounded-full px-3 py-1 text-sm font-medium ${
                  currentRecipient.sendStatus === 'pending'
                    ? 'bg-muted text-muted-foreground'
                    : currentRecipient.sendStatus === 'sent'
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                }`}>
                  {currentRecipient.sendStatus === 'pending' ? 'Pending' : currentRecipient.sendStatus === 'sent' ? 'Sent' : 'Skipped'}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Message preview</p>
                <p className="whitespace-pre-wrap text-sm">{currentRecipient.renderedMessage}</p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button className="h-[52px] text-base" onClick={() => copyToClipboard(currentRecipient.mobileForCopy, 'number')}>
                  {copiedField === 'number' ? <><Check className="mr-2 h-5 w-5" /> Copied!</> : <><Clipboard className="mr-2 h-5 w-5" /> Copy Number <kbd className="ml-1.5 rounded border border-current/20 px-1 text-[10px] opacity-50">N</kbd></>}
                </Button>
                <Button className="h-[52px] text-base" onClick={() => copyToClipboard(currentRecipient.renderedMessage, 'message')} style={copiedField === 'message' ? { backgroundColor: 'hsl(var(--success))' } : undefined}>
                  {copiedField === 'message' ? <><Check className="mr-2 h-5 w-5" /> Copied!</> : <><Clipboard className="mr-2 h-5 w-5" /> Copy Message <kbd className="ml-1.5 rounded border border-current/20 px-1 text-[10px] opacity-50">M</kbd></>}
                </Button>
              </div>

              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {!session.complianceAcknowledged && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                    <Checkbox
                      className="mt-0.5"
                      onCheckedChange={(v) => {
                        if (v) void updateSession({ complianceAcknowledged: true, status: session.status === 'paused' ? 'in_progress' : session.status });
                      }}
                    />
                    I confirm these patients have an existing relationship with this pharmacy.
                  </label>
                )}

                <div>
                  <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>

                {showSkipInput && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input placeholder="Reason for skip (optional)" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} className="sm:max-w-xs" />
                    <Button variant="outline" onClick={() => void markCurrentPatientSkipped()}>Confirm Skip</Button>
                    <Button variant="ghost" onClick={() => { setShowSkipInput(false); setSkipReason(''); }}>Keep Pending</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Queue</h3>
            <select
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value as QueueFilter)}
            >
              <option value="all">All patients</option>
              <option value="pending">Pending only</option>
              <option value="skipped">Skipped only</option>
            </select>
          </div>

          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {filteredRecipients.map((r) => {
              const realIdx = session.recipients.indexOf(r);
              const isCurrent = realIdx === session.currentIndex;
              return (
                <button
                  key={r.id}
                  className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                    isCurrent
                      ? 'border-primary bg-primary/10 text-primary'
                      : r.sendStatus === 'sent'
                        ? 'border-success/20 bg-success/5 text-foreground/65'
                        : r.sendStatus === 'skipped'
                          ? 'border-warning/20 bg-warning/5 text-foreground/80'
                          : 'border-transparent hover:bg-muted'
                  }`}
                  onClick={() => void navigateToRecipient(realIdx)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-medium ${r.sendStatus === 'sent' ? 'line-through' : ''}`}>{r.firstName} {r.lastName}</span>
                    <span className="text-xs">
                      {r.sendStatus === 'sent' && <span className="text-success">✓ Sent</span>}
                      {r.sendStatus === 'skipped' && <span className="text-warning">Skipped</span>}
                      {r.sendStatus === 'pending' && <span className="text-muted-foreground">Pending</span>}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRound className="h-3 w-3" /> Row {r.originalRowNumber}
                  </div>
                </button>
              );
            })}
            {filteredRecipients.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                No patients match this filter.
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-3 space-y-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowSessionSummary(true)}>
              View session summary
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => void pauseSession()}>
              <Pause className="mr-1 h-3 w-3" /> Pause & save
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Patient {session.currentIndex + 1} of {totalCount} — {currentRecipient?.firstName} {currentRecipient?.lastName}</p>
            <p className="text-xs text-muted-foreground">Enter = sent, S = skip, Z = undo, ←/→ = move, N = copy number, M = copy message</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void goToPreviousRecipient()} disabled={session.currentIndex === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            {!showSkipInput ? (
              <Button variant="outline" onClick={() => setShowSkipInput(true)} disabled={!currentRecipient || currentRecipient.sendStatus !== 'pending'}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip
              </Button>
            ) : (
              <Button variant="outline" onClick={() => { setShowSkipInput(false); setSkipReason(''); }}>
                <Undo2 className="mr-1 h-4 w-4" /> Keep Pending
              </Button>
            )}
            {lastAction && (
              <Button variant="outline" onClick={() => void undoLastAction()}>
                <Undo2 className="mr-1 h-4 w-4" /> Undo Last
              </Button>
            )}
            <Button onClick={() => void markCurrentPatientSent()} disabled={!session.complianceAcknowledged || !currentRecipient || currentRecipient.sendStatus !== 'pending'}>
              <Check className="mr-1 h-4 w-4" /> Mark Sent & Next
            </Button>
            <Button variant="outline" onClick={() => void goToNextRecipient()} disabled={session.currentIndex >= totalCount - 1}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {fallbackText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="mx-4 w-full max-w-md space-y-4 rounded-2xl bg-card p-6">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" /> Copy this text manually
            </div>
            <textarea className="w-full rounded-lg border border-border p-3 text-sm font-mono" rows={4} value={fallbackText} readOnly onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
            <Button className="w-full" onClick={() => setFallbackText(null)}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <p className={`text-3xl font-semibold ${className}`}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
