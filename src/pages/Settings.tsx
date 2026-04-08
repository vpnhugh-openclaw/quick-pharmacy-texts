import { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { normaliseAustralianMobile } from '@/lib/sms-utils';
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
      suppressionList: [...settings.suppressionList, { mobile: norm.forCopy, reason: suppReason, addedAt: new Date().toISOString() }],
    });
    setSuppMobile('');
    setSuppReason('');
  };

  const removeSuppression = (mobile: string) => {
    setSettings({ ...settings, suppressionList: settings.suppressionList.filter((s) => s.mobile !== mobile) });
  };

  return (
    <div className="space-y-8">
      <section className="max-w-4xl space-y-4">
        <p className="frost-pill text-[#3b9eff]">Configuration</p>
        <h1>Configure your delivery settings without leaving the workflow.</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Keep your pharmacy details, direct-send gateway, and safeguards in one place. Sensitive values stay masked unless you choose to reveal them.
        </p>
      </section>

      <section className="frost-panel space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/[0.04] p-2">
            <ShieldCheck className="h-5 w-5 text-[#3b9eff]" />
          </div>
          <div>
            <h2>httpSMS</h2>
            <p className="text-sm text-muted-foreground">Direct-to-phone sending for your Android gateway.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-foreground">httpSMS API Key</label>
            <div className="flex gap-2">
              <Input
                data-testid="settings-api-key-input"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                placeholder="Paste your httpSMS API key"
                onChange={(e) => {
                  const value = e.target.value;
                  setApiKey(value);
                  persistHttpSmsSettings(value, fromNumberInput);
                }}
              />
              <Button data-testid="settings-toggle-api-key" variant="outline" size="icon" type="button" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => setShowApiKey((value) => !value)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Get your key from httpsms.com/settings</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Your Phone Number</label>
            <Input
              data-testid="settings-from-number-input"
              type="tel"
              value={formattedFromNumber}
              placeholder="e.g. 0412 345 678"
              onChange={(e) => setFromNumberInput(e.target.value)}
              onBlur={handleFromNumberBlur}
            />
            <p className="text-xs text-muted-foreground">The number registered in the httpSMS app on your Android phone</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Connection test</label>
            <Button data-testid="settings-test-connection" variant="outline" className="w-full rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => void handleTestConnection()} disabled={testStatus.state === 'loading'}>
              {testStatus.state === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Connection
            </Button>
            {testStatus.state !== 'idle' && (
              <p className={`text-sm ${testStatus.state === 'success' ? 'text-[#11ff99]' : testStatus.state === 'error' ? 'text-[#ff8aa0]' : 'text-muted-foreground'}`}>
                {testStatus.message}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="frost-panel space-y-4 p-6">
          <h2>Pharmacy details</h2>
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
        </div>

        <div className="frost-panel space-y-4 p-6">
          <h2>Send defaults</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Batch soft cap</label>
              <Input type="number" value={settings.batchSoftCap} onChange={(e) => updateField('batchSoftCap', parseInt(e.target.value, 10) || 50)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Default opt-out text</label>
              <Input value={settings.defaultOptOutText} onChange={(e) => updateField('defaultOptOutText', e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="frost-panel space-y-4 p-6">
          <h2>Saved templates</h2>
          {savedTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved templates yet.</p>
          ) : (
            <div className="space-y-2">
              {savedTemplates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{template.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{template.body}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSavedTemplates(savedTemplates.filter((item) => item.id !== template.id))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="frost-panel space-y-4 p-6">
          <h2>Suppression list</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Mobile number" value={suppMobile} onChange={(e) => setSuppMobile(e.target.value)} className="flex-1" />
            <Input placeholder="Reason" value={suppReason} onChange={(e) => setSuppReason(e.target.value)} className="flex-1" />
            <Button variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={addSuppression}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {settings.suppressionList.length > 0 ? (
            <div className="table-shell">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Mobile</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                    <th className="px-4 py-3 text-left font-medium">Added</th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {settings.suppressionList.map((entry) => (
                    <tr key={entry.mobile} className="border-b border-white/10 last:border-0">
                      <td className="px-4 py-3 font-mono text-muted-foreground">{entry.mobile}</td>
                      <td className="px-4 py-3">{entry.reason}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(entry.addedAt).toLocaleDateString('en-AU')}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => removeSuppression(entry.mobile)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No suppressed numbers yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
