import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clipboard, Check, SkipForward, Undo2, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { renderMessage, generateId } from '@/lib/sms-utils';
import { saveSession } from '@/lib/persistence';
import type { SendSession, SendSessionRecipient } from '@/types';

export default function SendPage() {
  const navigate = useNavigate();
  const { recipients, messageTemplate, sessionName, settings, activeSession, setActiveSession } = useAppStore();
  const [copiedField, setCopiedField] = useState<'number' | 'message' | null>(null);
  const [showSkipInput, setShowSkipInput] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [note, setNote] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const instructionsDismissed = localStorage.getItem('hughs-instructions-dismissed') === 'true';
  const [showInstructions, setShowInstructions] = useState(!instructionsDismissed);

  // Initialize session
  useEffect(() => {
    if (activeSession) return;

    const selected = recipients.filter(r => r.isSelected);
    if (selected.length === 0) {
      navigate('/review');
      return;
    }

    const appendOptOut = false; // already handled in message template if user chose it
    const sessionRecipients: SendSessionRecipient[] = selected.map(r => ({
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
    saveSession(session);
  }, []);

  const session = activeSession;

  const updateSession = useCallback((updates: Partial<SendSession>) => {
    if (!session) return;
    const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
    setActiveSession(updated);
    saveSession(updated);
  }, [session, setActiveSession]);

  const updateRecipient = useCallback((index: number, updates: Partial<SendSessionRecipient>) => {
    if (!session) return;
    const newRecipients = [...session.recipients];
    newRecipients[index] = { ...newRecipients[index], ...updates };
    updateSession({ recipients: newRecipients });
  }, [session, updateSession]);

  const advanceToNextPending = useCallback(() => {
    if (!session) return;
    const nextIndex = session.recipients.findIndex((r, i) => i > session.currentIndex && r.sendStatus === 'pending');
    if (nextIndex >= 0) {
      updateSession({ currentIndex: nextIndex });
    } else {
      const wrapIndex = session.recipients.findIndex(r => r.sendStatus === 'pending');
      if (wrapIndex >= 0) {
        updateSession({ currentIndex: wrapIndex });
      } else {
        updateSession({ status: 'completed' });
      }
    }
    setShowSkipInput(false);
    setSkipReason('');
    setNote('');
  }, [session, updateSession]);

  if (!session) return null;

  const currentRecipient = session.recipients[session.currentIndex];
  const sentCount = session.recipients.filter(r => r.sendStatus === 'sent').length;
  const skippedCount = session.recipients.filter(r => r.sendStatus === 'skipped').length;
  const pendingCount = session.recipients.filter(r => r.sendStatus === 'pending').length;
  const isComplete = pendingCount === 0;

  const copyToClipboard = async (text: string, field: 'number' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setFallbackText(text);
    }
  };

  const markSent = () => {
    if (note) updateRecipient(session.currentIndex, { notes: note });
    updateRecipient(session.currentIndex, { sendStatus: 'sent', sentAt: new Date().toISOString() });
    setTimeout(advanceToNextPending, 100);
  };

  const markSkipped = () => {
    if (note) updateRecipient(session.currentIndex, { notes: note });
    updateRecipient(session.currentIndex, { sendStatus: 'skipped', skipReason: skipReason || null });
    setTimeout(advanceToNextPending, 100);
  };

  const pauseSession = () => {
    updateSession({ status: 'paused' });
    navigate('/upload');
  };

  if (isComplete || session.status === 'completed') {
    return (
      <div className="mx-auto max-w-lg text-center space-y-6 py-12">
        <div className="rounded-2xl border border-border bg-card p-8">
          <h2 className="mb-2 text-2xl font-medium">Session complete</h2>
          <p className="text-muted-foreground">{sentCount} sent · {skippedCount} skipped</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate('/results')}>View Full Results</Button>
          <Button variant="outline" onClick={() => {
            navigate('/results');
          }}>Download Updated Spreadsheet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {showInstructions && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="mb-2 font-medium">How to send each message:</p>
          <p className="text-muted-foreground">Keep this tab open alongside <strong>messages.google.com</strong> in another tab.</p>
          <ol className="mt-2 ml-4 list-decimal space-y-1 text-muted-foreground">
            <li>Tap <strong>Copy Number</strong> → switch to Messages tab → paste into "To:" → Enter</li>
            <li>Tap <strong>Copy Message</strong> → switch to Messages tab → paste into message field → Send</li>
            <li>Return here → tap <strong>Mark Sent</strong></li>
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

      <div className="mb-4 rounded-xl bg-muted p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{session.currentIndex + 1} of {session.recipients.length}</span>
          <span className="text-muted-foreground">{sentCount} sent · {skippedCount} skipped</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((sentCount + skippedCount) / session.recipients.length) * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Active patient card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          {currentRecipient && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Row {currentRecipient.originalRowNumber}</p>
                <h2 className="text-xl font-medium">{currentRecipient.firstName} {currentRecipient.lastName}</h2>
                <p className="font-mono text-muted-foreground">{currentRecipient.mobileDisplay}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-48 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm">{currentRecipient.renderedMessage}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-[52px] text-base"
                  onClick={() => copyToClipboard(currentRecipient.mobileForCopy, 'number')}
                >
                  {copiedField === 'number' ? (
                    <><Check className="mr-2 h-5 w-5" /> Copied!</>
                  ) : (
                    <><Clipboard className="mr-2 h-5 w-5" /> Copy Number</>
                  )}
                </Button>
                <Button
                  className="h-[52px] text-base"
                  onClick={() => copyToClipboard(currentRecipient.renderedMessage, 'message')}
                  style={copiedField === 'message' ? { backgroundColor: 'hsl(var(--success))' } : undefined}
                >
                  {copiedField === 'message' ? (
                    <><Check className="mr-2 h-5 w-5" /> Copied!</>
                  ) : (
                    <><Clipboard className="mr-2 h-5 w-5" /> Copy Message</>
                  )}
                </Button>
              </div>

              <div className="border-t border-border pt-4">
                {!session.complianceAcknowledged && (
                  <label className="mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      onCheckedChange={v => {
                        if (v) updateSession({ complianceAcknowledged: true });
                      }}
                    />
                    I confirm these patients have an existing relationship with this pharmacy.
                  </label>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={markSent}
                    disabled={!session.complianceAcknowledged}
                  >
                    <Check className="mr-1 h-4 w-4" /> Mark Sent
                  </Button>

                  {!showSkipInput ? (
                    <Button variant="outline" onClick={() => setShowSkipInput(true)}>
                      <SkipForward className="mr-1 h-4 w-4" /> Skip
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Reason (optional)"
                        value={skipReason}
                        onChange={e => setSkipReason(e.target.value)}
                        className="w-40"
                      />
                      <Button variant="outline" size="sm" onClick={markSkipped}>Confirm Skip</Button>
                    </div>
                  )}

                  <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => { setShowSkipInput(false); setSkipReason(''); }}>
                    <Undo2 className="h-3 w-3" /> Keep Pending
                  </button>
                </div>

                <div className="mt-3">
                  <Input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Queue panel */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Queue</h3>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={showPendingOnly} onCheckedChange={v => setShowPendingOnly(!!v)} />
              Pending only
            </label>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {session.recipients
              .filter(r => !showPendingOnly || r.sendStatus === 'pending')
              .map((r, idx) => {
                const realIdx = session.recipients.indexOf(r);
                return (
                  <button
                    key={r.id}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      realIdx === session.currentIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => updateSession({ currentIndex: realIdx })}
                  >
                    <span className="font-medium">{r.firstName} {r.lastName}</span>
                    <span className="ml-2">
                      {r.sendStatus === 'sent' && <span className="text-xs text-success">✓ Sent</span>}
                      {r.sendStatus === 'skipped' && <span className="text-xs text-warning">Skipped</span>}
                      {r.sendStatus === 'pending' && <span className="text-xs text-muted-foreground">Pending</span>}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <Button variant="outline" size="sm" className="w-full" onClick={pauseSession}>
              <Pause className="mr-1 h-3 w-3" /> Pause & save
            </Button>
          </div>
        </div>
      </div>

      {/* Fallback modal */}
      {fallbackText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-card p-6 space-y-4">
            <p className="text-sm font-medium">Copy this text manually:</p>
            <textarea className="w-full rounded-lg border border-border p-3 text-sm font-mono" rows={4} value={fallbackText} readOnly onClick={e => (e.target as HTMLTextAreaElement).select()} />
            <Button className="w-full" onClick={() => setFallbackText(null)}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
