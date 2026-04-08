import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/store/app-store';
import { calculateSegments, renderMessage, generateId } from '@/lib/sms-utils';

export default function MessageBuilderPage() {
  const navigate = useNavigate();
  const { messageTemplate, setMessageTemplate, sessionName, setSessionName, recipients, settings, savedTemplates, setSavedTemplates } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [appendOptOut, setAppendOptOut] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const selected = recipients.filter(r => r.isSelected);
  const fullMessage = appendOptOut ? `${messageTemplate}\n${settings.defaultOptOutText}` : messageTemplate;

  // Worst case: longest first name
  const longestName = selected.reduce((longest, r) => r.firstNameForSms.length > longest.length ? r.firstNameForSms : longest, '');
  const worstCase = fullMessage.replace(/\{firstName\}/g, longestName);
  const segInfo = calculateSegments(worstCase);

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = messageTemplate.slice(0, start) + token + messageTemplate.slice(end);
    setMessageTemplate(newVal);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const t = { id: generateId(), name: templateName.trim(), body: messageTemplate, createdAt: new Date().toISOString() };
    setSavedTemplates([...savedTemplates, t]);
    setTemplateName('');
  };

  useEffect(() => {
    if (selected.length === 0) navigate('/review');
  }, [selected.length, navigate]);

  if (selected.length === 0) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Session name</label>
        <Input value={sessionName} onChange={e => setSessionName(e.target.value)} />
      </div>

      {savedTemplates.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Load template</label>
          <select
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            onChange={e => {
              const tmpl = savedTemplates.find(t => t.id === e.target.value);
              if (tmpl) setMessageTemplate(tmpl.body);
            }}
            defaultValue=""
          >
            <option value="" disabled>Choose a saved template…</option>
            {savedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Message</label>
        <Textarea
          data-testid="message-template-textarea"
          ref={textareaRef}
          value={messageTemplate}
          onChange={e => setMessageTemplate(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {['{firstName}', '{pharmacyName}', '{pharmacyPhone}', '{bookingLink}'].map(token => (
          <Button key={token} variant="outline" size="sm" onClick={() => insertToken(token)}>
            {token}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <p className={`text-sm font-medium ${segInfo.segments >= 3 ? 'text-destructive' : segInfo.segments >= 2 ? 'text-warning' : 'text-muted-foreground'}`}>
          {segInfo.chars} chars · {segInfo.encoding} · {segInfo.segments} segment{segInfo.segments !== 1 ? 's' : ''} (worst case)
        </p>
      </div>

      {segInfo.segments >= 3 && (
        <p className="text-sm text-destructive">Very long — {segInfo.segments} segments per patient. Consider shortening.</p>
      )}
      {segInfo.segments === 2 && (
        <p className="text-sm text-warning">Sends as 2 separate texts per patient.</p>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={appendOptOut} onCheckedChange={v => setAppendOptOut(!!v)} />
        Append "{settings.defaultOptOutText}"
      </label>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Live preview</p>
        <div className="space-y-3">
          {selected.slice(0, 3).map(r => (
            <div key={r.id} data-testid="message-preview-card" className="rounded-xl border border-border p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{r.firstName} {r.lastName}</p>
              <p className="whitespace-pre-wrap">{renderMessage(fullMessage, r, settings)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border p-3">
        <Input placeholder="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} className="flex-1" />
        <Button variant="outline" size="sm" onClick={saveTemplate} disabled={!templateName.trim()}>
          <Save className="mr-1 h-3 w-3" /> Save template
        </Button>
      </div>

      <div className="flex justify-end">
        <Button data-testid="message-start-sending" disabled={!messageTemplate.trim()} onClick={() => navigate('/send')}>
          Start sending <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
