import { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { normaliseAustralianMobile, generateId } from '@/lib/sms-utils';
import { isValidAUMobile, testConnection, toE164AU } from '@/services/httpsms';

const HTTPSMS_API_KEY_STORAGE = 'httpsms_api_key';
const HTTPSMS_FROM_NUMBER_STORAGE = 'httpsms_from_number';

export default function SettingsPage() {
  const { settings, setSettings, savedTemplates, setSavedTemplates } = useAppStore();
  const [suppMobile, setSuppMobile] = useState('');
  const [suppReason, setSuppReason] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(HTTPSMS_API_KEY_STORAGE) ?? '');
  const [fromNumberInput, setFromNumberInput] = useState(() => localStorage.getItem(HTTPSMS_FROM_NUMBER_STORAGE) ?? '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });

  const formattedFromNumber = useMemo(() => {
    if (!fromNumberInput) return '';
    if (fromNumberInput.startsWith('+61')) {
      return `0${fromNumberInput.slice(3)}`.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    const digits = fromNumberInput.replace(/\D/g, '');
    return digits.length === 10 ? digits.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : fromNumberInput;
  }, [fromNumberInput]);

  const updateField = (field: keyof typeof settings, value: string | number) => {
    setSettings({ ...settings, [field]: value });
  };

  const persistHttpSmsSettings = (nextApiKey: string, nextFromNumber: string) => {
    localStorage.setItem(HTTPSMS_API_KEY_STORAGE, nextApiKey);
    localStorage.setItem(HTTPSMS_FROM_NUMBER_STORAGE, nextFromNumber);
  };

  const handleFromNumberBlur = () => {
    const trimmed = fromNumberInput.trim();
    if (!trimmed) {
      persistHttpSmsSettings(apiKey, '');
      return;
    }

    const normalised = toE164AU(trimmed);
    if (isValidAUMobile(normalised)) {
      setFromNumberInput(normalised);
      persistHttpSmsSettings(apiKey, normalised);
    }
  };

  const handleTestConnection = async () => {
    const from = toE164AU(fromNumberInput);
    if (!apiKey || !isValidAUMobile(from)) {
      setTestStatus({ state: 'error', message: 'Enter a valid API key and registered mobile number' });
      return;
    }

    setTestStatus({ state: 'loading', message: 'Sending test…' });
    const result = await testConnection({ apiKey, from });
    if (result.success) {
      setTestStatus({ state: 'success', message: '✓ Test SMS sent' });
      persistHttpSmsSettings(apiKey, from);
      return;
    }

    setTestStatus({ state: 'error', message: `✗ Failed: ${result.error}` });
  };

  const addSuppression = () => {
    const norm = normaliseAustralianMobile(suppMobile);
    if (!norm.isValid) return;
    setSettings({
      ...settings,
      suppressionList: [...settings.suppressionList, { mobile: norm.forCopy, reason: suppReason, addedAt: new Date().toISOString() }]
    });
    setSuppMobile('');
    setSuppReason('');
  };

  const removeSuppression = (mobile: string) => {
    setSettings({ ...settings, suppressionList: settings.suppressionList.filter((s) => s.mobile !== mobile) });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">httpSMS</h2>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <label className="mb-1 block text-sm font-medium">httpSMS API Key</label>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                placeholder="Paste your httpSMS API key"
                onChange={(e) => {
                  const value = e.target.value;
                  setApiKey(value);
                  persistHttpSmsSettings(value, fromNumberInput);
                }}
              />
              <Button variant="outline" size="icon" type="button" onClick={() => setShowApiKey((value) => !value)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Get your key from httpsms.com/settings</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Your Phone Number</label>
            <Input
              type="tel"
              value={formattedFromNumber}
              placeholder="e.g. 0412 345 678"
              onChange={(e) => setFromNumberInput(e.target.value)}
              onBlur={handleFromNumberBlur}
            />
            <p className="mt-1 text-xs text-muted-foreground">The number registered in the httpSMS app on your Android phone</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => void handleTestConnection()} disabled={testStatus.state === 'loading'}>
              {testStatus.state === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Connection
            </Button>
            {testStatus.state !== 'idle' && (
              <p className={`text-sm ${testStatus.state === 'success' ? 'text-success' : testStatus.state === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {testStatus.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Pharmacy details</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Pharmacy name</label>
            <Input value={settings.pharmacyName} onChange={(e) => updateField('pharmacyName', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Phone number</label>
            <Input value={settings.pharmacyPhone} onChange={(e) => updateField('pharmacyPhone', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Booking link</label>
            <Input value={settings.bookingLink} onChange={(e) => updateField('bookingLink', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Send defaults</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Batch soft cap</label>
          <Input type="number" value={settings.batchSoftCap} onChange={(e) => updateField('batchSoftCap', parseInt(e.target.value, 10) || 50)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Default opt-out text</label>
          <Input value={settings.defaultOptOutText} onChange={(e) => updateField('defaultOptOutText', e.target.value)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Saved templates</h2>
        {savedTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved templates yet.</p>
        ) : (
          <div className="space-y-2">
            {savedTemplates.map((t) => (
              <div key={t.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.body}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSavedTemplates(savedTemplates.filter((x) => x.id !== t.id))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Suppression list</h2>
        <div className="flex gap-2">
          <Input placeholder="Mobile number" value={suppMobile} onChange={(e) => setSuppMobile(e.target.value)} className="flex-1" />
          <Input placeholder="Reason" value={suppReason} onChange={(e) => setSuppReason(e.target.value)} className="flex-1" />
          <Button variant="outline" size="sm" onClick={addSuppression}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {settings.suppressionList.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Mobile</th>
                  <th className="px-3 py-2 text-left font-medium">Reason</th>
                  <th className="px-3 py-2 text-left font-medium">Added</th>
                  <th className="w-10 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {settings.suppressionList.map((s) => (
                  <tr key={s.mobile} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono">{s.mobile}</td>
                    <td className="px-3 py-2">{s.reason}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(s.addedAt).toLocaleDateString('en-AU')}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" onClick={() => removeSuppression(s.mobile)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Import defaults</h2>
        <p className="text-sm text-muted-foreground">Parser mode: Blackshaws Format</p>
      </section>
    </div>
  );
}
