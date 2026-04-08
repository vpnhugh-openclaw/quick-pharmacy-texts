import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { parseSpreadsheet } from '@/lib/spreadsheet';
import { getActiveSession } from '@/lib/persistence';
import type { SendSession } from '@/types';

export default function UploadPage() {
  const navigate = useNavigate();
  const { parseResult, setParseResult, settings, fileName, restoreSessionContext } = useAppStore();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SendSession | null>(null);

  useEffect(() => {
    getActiveSession().then(s => s && setActiveSession(s));
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setError('Please upload an .xlsx file');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseSpreadsheet(buffer, settings);
        setParseResult(result, buffer, file.name);
      } catch (err: any) {
        setError(`Failed to parse: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [settings, setParseResult]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {activeSession && (
        <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Unfinished session: {activeSession.sourceFileName} · {activeSession.recipients.filter(r => r.sendStatus === 'sent').length} of {activeSession.recipients.length} sent
            </span>
          </div>
          <Button size="sm" onClick={() => {
            restoreSessionContext(activeSession);
            navigate('/send');
          }}>
            Resume <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}

      {!parseResult ? (
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 transition-colors cursor-pointer ${
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx';
            input.onchange = () => input.files?.[0] && handleFile(input.files[0]);
            input.click();
          }}
        >
          <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-1 text-lg font-medium">Drop your patient spreadsheet here</p>
          <p className="text-sm text-muted-foreground">Blackshaws format — message in rows 1–2 (merged), headers in row 3, patients from row 4</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 border border-border">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{fileName}</p>
              <p className="text-sm text-muted-foreground">{parseResult.stats.total} patients found</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => useAppStore.getState().resetImport()}>
              Upload different file
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip icon={CheckCircle} iconClass="text-success" label="Valid" value={parseResult.stats.valid} />
            <StatChip icon={XCircle} iconClass="text-muted-foreground" label="Already texted" value={parseResult.stats.alreadyTexted} />
            <StatChip icon={AlertTriangle} iconClass="text-warning" label="Duplicates" value={parseResult.stats.duplicates} />
            <StatChip icon={XCircle} iconClass="text-destructive" label="Invalid" value={parseResult.stats.invalid} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Message from spreadsheet</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{parseResult.template}</p>
            {!parseResult.template.includes('{firstName}') && (
              <p className="mt-2 text-sm text-info">ℹ No personalisation detected. You can add {'{firstName}'} on the next step.</p>
            )}
          </div>

          {parseResult.warnings.length > 0 && (
            <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4">
              <p className="mb-2 text-sm font-medium text-warning">Warnings</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {parseResult.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}
                {parseResult.warnings.length > 20 && (
                  <li className="text-muted-foreground">…and {parseResult.warnings.length - 20} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Row</th>
                  <th className="px-3 py-2 text-left font-medium">First Name</th>
                  <th className="px-3 py-2 text-left font-medium">Last Name</th>
                  <th className="px-3 py-2 text-left font-medium">Mobile</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.recipients.slice(0, 10).map(r => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{r.originalRowNumber}</td>
                    <td className="px-3 py-2">{r.firstName}</td>
                    <td className="px-3 py-2">{r.lastName}</td>
                    <td className="px-3 py-2 font-mono text-sm">{r.mobileDisplay}</td>
                    <td className="px-3 py-2">
                      <StatusChip recipient={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => navigate('/review')}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

function StatChip({ icon: Icon, iconClass, label, value }: { icon: any; iconClass: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
      <Icon className={`h-4 w-4 ${iconClass}`} />
      <div>
        <p className="text-lg font-medium leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function StatusChip({ recipient }: { recipient: any }) {
  if (recipient.isAlreadyTexted) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Already Texted</span>;
  if (!recipient.isValidMobile) return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Invalid</span>;
  if (recipient.isDuplicate) return <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">Duplicate</span>;
  return <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Valid</span>;
}
