import { useNavigate } from 'react-router-dom';
import { Download, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { exportSpreadsheet, exportCSV } from '@/lib/spreadsheet';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { activeSession, originalFileBuffer } = useAppStore();

  if (!activeSession) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="frost-pill text-[#3b9eff]">No active results</p>
        <h1 className="mt-4">No session results to display yet.</h1>
        <p className="mt-4 text-muted-foreground">Start from Upload to import a sheet and process a patient batch.</p>
        <Button className="mt-6 rounded-full" onClick={() => navigate('/upload')}>
          Go to Upload <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  const session = activeSession;
  const sentCount = session.recipients.filter((r) => r.sendStatus === 'sent').length;
  const skippedCount = session.recipients.filter((r) => r.sendStatus === 'skipped').length;
  const pendingCount = session.recipients.filter((r) => r.sendStatus === 'pending').length;
  const total = session.recipients.length;
  const pct = Math.round(((sentCount + skippedCount) / total) * 100);

  const downloadSpreadsheet = () => {
    if (!originalFileBuffer) return;
    const buf = exportSpreadsheet(originalFileBuffer, session.recipients, session.sourceFileName);
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.sourceFileName.replace(/\.xlsx$/i, '')}_updated.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    const csv = exportCSV(session.recipients, session.sourceFileName);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.sourceFileName.replace(/\.xlsx$/i, '')}_summary.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section className="max-w-4xl space-y-4">
        <p className="frost-pill text-[#11ff99]">Results</p>
        <h1>Track the finished batch and export exactly what changed.</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Review sent, skipped, and pending patients at a glance, then download an updated spreadsheet or CSV summary for your records.
        </p>
      </section>

      <section className="frost-panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2>Session results</h2>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>Source: {session.sourceFileName}</p>
              <p>Created: {new Date(session.createdAt).toLocaleString('en-AU')}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Sent" value={sentCount} tone="text-[#11ff99]" />
            <Metric label="Skipped" value={skippedCount} tone="text-[#ffc53d]" />
            <Metric label="Pending" value={pendingCount} tone="text-muted-foreground" />
            <Metric label="Complete" value={`${pct}%`} tone="text-foreground" />
          </div>
        </div>
      </section>

      <section className="table-shell">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Row</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Mobile</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Sent at</th>
              <th className="px-4 py-3 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {session.recipients.map((recipient) => (
              <tr data-testid="results-row" key={recipient.id} className="border-b border-white/10 last:border-0">
                <td className="px-4 py-3 text-muted-foreground">{recipient.originalRowNumber}</td>
                <td className="px-4 py-3">{recipient.firstName} {recipient.lastName}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{recipient.mobileDisplay}</td>
                <td className="px-4 py-3">
                  {recipient.sendStatus === 'sent' && <span className="frost-pill bg-[#11ff99]/10 text-[#11ff99]">Sent</span>}
                  {recipient.sendStatus === 'skipped' && <span className="frost-pill bg-[#ffc53d]/10 text-[#ffc53d]">Skipped</span>}
                  {recipient.sendStatus === 'pending' && <span className="frost-pill text-muted-foreground">Pending</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{recipient.sentAt ? new Date(recipient.sentAt).toLocaleTimeString('en-AU') : '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{recipient.notes || recipient.skipReason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button data-testid="results-download-spreadsheet" className="rounded-full" onClick={downloadSpreadsheet} disabled={!originalFileBuffer}>
          <Download className="mr-2 h-4 w-4" /> Download Updated Spreadsheet
        </Button>
        <Button data-testid="results-download-csv" variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10" onClick={downloadCSV}>
          <Download className="mr-2 h-4 w-4" /> Download CSV Summary
        </Button>
        <Button
          variant="outline"
          className="rounded-full border-white/10 bg-white/5 hover:bg-white/10"
          onClick={() => {
            useAppStore.getState().setActiveSession(null);
            navigate('/upload');
          }}
        >
          Send another batch
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <p className={`text-3xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    </div>
  );
}
