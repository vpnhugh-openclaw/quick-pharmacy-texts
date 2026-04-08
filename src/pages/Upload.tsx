import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { parseSpreadsheet } from '@/lib/spreadsheet';
import { getActiveSession } from '@/lib/persistence';
import type { ImportedRecipient, SendSession } from '@/types';

export default function UploadPage() {
  const navigate = useNavigate();
  const { parseResult, setParseResult, settings, fileName, restoreSessionContext } = useAppStore();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SendSession | null>(null);

  useEffect(() => {
    getActiveSession().then((s) => s && setActiveSession(s));
  }, []);

  const handleFile = useCallback(
    (file: File) => {
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
        } catch (err) {
          setError(`Failed to parse: ${(err as Error).message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [settings, setParseResult]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="max-w-4xl">
          <p className="frost-pill text-[#ffa057]">Upload and prepare</p>
          <h1 className="mt-4">Load your patient list and move through each send with confidence.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Import the spreadsheet, review the patient list, and keep your workflow tidy with clear status tracking before you send.
          </p>
        </div>
      </section>

      {activeSession && (
        <div className="frost-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-[#11ff99]" />
            <div>
              <p className="text-sm font-medium text-foreground">Unfinished session</p>
              <p className="text-sm text-muted-foreground">
                {activeSession.sourceFileName} · {activeSession.recipients.filter((r) => r.sendStatus === 'sent').length} of {activeSession.recipients.length} sent
              </p>
            </div>
          </div>
          <Button className="rounded-full" onClick={() => { restoreSessionContext(activeSession); navigate('/send'); }}>
            Resume session <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {!parseResult ? (
        <div
          className={`frost-panel cursor-pointer px-6 py-16 text-center transition-colors ${dragging ? 'border-white/30 bg-white/10' : 'hover:border-white/20 hover:bg-white/[0.06]'}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
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
          <Upload className="mx-auto mb-6 h-14 w-14 text-[#3b9eff]" />
          <h2>Drop your patient spreadsheet here</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Blackshaws format, message in rows 1 to 2, headers in row 3, patients from row 4.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="frost-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <FileSpreadsheet className="h-10 w-10 text-[#3b9eff]" />
            <div>
              <p className="text-lg font-medium text-foreground">{fileName}</p>
              <p className="text-sm text-muted-foreground">{parseResult.stats.total} patients found</p>
            </div>
            <Button variant="outline" className="ml-auto rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={() => useAppStore.getState().resetImport()}>
              Upload different file
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatChip icon={CheckCircle} iconClass="text-[#11ff99]" label="Valid" value={parseResult.stats.valid} />
            <StatChip icon={XCircle} iconClass="text-muted-foreground" label="Already texted" value={parseResult.stats.alreadyTexted} />
            <StatChip icon={AlertTriangle} iconClass="text-[#ffc53d]" label="Duplicates" value={parseResult.stats.duplicates} />
            <StatChip icon={XCircle} iconClass="text-[#ff2047]" label="Invalid" value={parseResult.stats.invalid} />
          </div>

          <div className="frost-panel p-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Message from spreadsheet</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{parseResult.template}</p>
            {!parseResult.template.includes('{firstName}') && (
              <p className="mt-3 text-sm text-[#3b9eff]">No personalisation detected. You can add {'{firstName}'} on the next step.</p>
            )}
          </div>

          {parseResult.warnings.length > 0 && (
            <div className="frost-panel border-[#ffc53d]/20 bg-[#ffc53d]/5 p-5">
              <p className="text-sm font-medium text-[#ffc53d]">Warnings</p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {parseResult.warnings.slice(0, 20).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
                {parseResult.warnings.length > 20 && <li>…and {parseResult.warnings.length - 20} more</li>}
              </ul>
            </div>
          )}

          <div className="table-shell">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Row</th>
                  <th className="px-4 py-3 text-left font-medium">First Name</th>
                  <th className="px-4 py-3 text-left font-medium">Last Name</th>
                  <th className="px-4 py-3 text-left font-medium">Mobile</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.recipients.slice(0, 10).map((recipient) => (
                  <tr key={recipient.id} className="border-b border-white/10 last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{recipient.originalRowNumber}</td>
                    <td className="px-4 py-3">{recipient.firstName}</td>
                    <td className="px-4 py-3">{recipient.lastName}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{recipient.mobileDisplay}</td>
                    <td className="px-4 py-3">
                      <StatusChip recipient={recipient} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button className="rounded-full px-6" onClick={() => navigate('/review')}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="frost-panel border-[#ff2047]/30 bg-[#ff2047]/5 p-4 text-sm text-[#ff8aa0]">
          {error}
        </div>
      )}
    </div>
  );
}

function StatChip({ icon: Icon, iconClass, label, value }: { icon: typeof CheckCircle; iconClass: string; label: string; value: number }) {
  return (
    <div className="frost-panel flex items-center gap-3 p-4">
      <div className="rounded-full border border-white/10 bg-white/[0.04] p-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function StatusChip({ recipient }: { recipient: ImportedRecipient }) {
  if (recipient.isAlreadyTexted) return <span className="frost-pill text-muted-foreground">Already Texted</span>;
  if (!recipient.isValidMobile) return <span className="frost-pill bg-[#ff2047]/10 text-[#ff8aa0]">Invalid</span>;
  if (recipient.isDuplicate) return <span className="frost-pill bg-[#ffc53d]/10 text-[#ffc53d]">Duplicate</span>;
  return <span className="frost-pill bg-[#11ff99]/10 text-[#11ff99]">Valid</span>;
}
