import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { normaliseAustralianMobile, generateId } from '@/lib/sms-utils';

export default function SettingsPage() {
  const { settings, setSettings, savedTemplates, setSavedTemplates } = useAppStore();
  const [suppMobile, setSuppMobile] = useState('');
  const [suppReason, setSuppReason] = useState('');

  const updateField = (field: string, value: string | number) => {
    setSettings({ ...settings, [field]: value });
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
    setSettings({ ...settings, suppressionList: settings.suppressionList.filter(s => s.mobile !== mobile) });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Pharmacy details</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Pharmacy name</label>
            <Input value={settings.pharmacyName} onChange={e => updateField('pharmacyName', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Phone number</label>
            <Input value={settings.pharmacyPhone} onChange={e => updateField('pharmacyPhone', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Booking link</label>
            <Input value={settings.bookingLink} onChange={e => updateField('bookingLink', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Send defaults</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Batch soft cap</label>
          <Input type="number" value={settings.batchSoftCap} onChange={e => updateField('batchSoftCap', parseInt(e.target.value) || 50)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Default opt-out text</label>
          <Input value={settings.defaultOptOutText} onChange={e => updateField('defaultOptOutText', e.target.value)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Saved templates</h2>
        {savedTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved templates yet.</p>
        ) : (
          <div className="space-y-2">
            {savedTemplates.map(t => (
              <div key={t.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.body}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSavedTemplates(savedTemplates.filter(x => x.id !== t.id))}>
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
          <Input placeholder="Mobile number" value={suppMobile} onChange={e => setSuppMobile(e.target.value)} className="flex-1" />
          <Input placeholder="Reason" value={suppReason} onChange={e => setSuppReason(e.target.value)} className="flex-1" />
          <Button variant="outline" size="sm" onClick={addSuppression}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {settings.suppressionList.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Mobile</th>
                  <th className="px-3 py-2 text-left font-medium">Reason</th>
                  <th className="px-3 py-2 text-left font-medium">Added</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {settings.suppressionList.map(s => (
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
        <h2 className="text-lg font-medium mb-2">Import defaults</h2>
        <p className="text-sm text-muted-foreground">Parser mode: Blackshaws Format</p>
      </section>
    </div>
  );
}
