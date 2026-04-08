import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { exportSpreadsheet, exportCSV } from '@/lib/spreadsheet';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { activeSession, originalFileBuffer, sessionName } = useAppStore();

  if (!activeSession) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-muted-foreground">No session results to display.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/upload')}>Go to Upload</Button>
      </div>
    );
  }

  const session = activeSession;
  const sentCount = session.recipients.filter(r => r.sendStatus === 'sent').length;
  const skippedCount = session.recipients.filter(r => r.sendStatus === 'skipped').length;
  const pendingCount = session.recipients.filter(r => r.sendStatus === 'pending').length;
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-xl font-medium">Session Results</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><p className="text-2xl font-medium text-success">{sentCount}</p><p className="text-sm text-muted-foreground">Sent</p></div>
          <div><p className="text-2xl font-medium text-warning">{skippedCount}</p><p className="text-sm text-muted-foreground">Skipped</p></div>
          <div><p className="text-2xl font-medium">{pendingCount}</p><p className="text-sm text-muted-foreground">Pending</p></div>
          <div><p className="text-2xl font-medium">{pct}%</p><p className="text-sm text-muted-foreground">Complete</p></div>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>Source: {session.sourceFileName}</p>
          <p>Created: {new Date(session.createdAt).toLocaleString('en-AU')}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Row</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Mobile</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Sent at</th>
              <th className="px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {session.recipients.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-muted-foreground">{r.originalRowNumber}</td>
                <td className="px-3 py-2">{r.firstName} {r.lastName}</td>
                <td className="px-3 py-2 font-mono">{r.mobileDisplay}</td>
                <td className="px-3 py-2">
                  {r.sendStatus === 'sent' && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Sent</span>}
                  {r.sendStatus === 'skipped' && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">Skipped</span>}
                  {r.sendStatus === 'pending' && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Pending</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.sentAt ? new Date(r.sentAt).toLocaleTimeString('en-AU') : '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.notes || r.skipReason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={downloadSpreadsheet} disabled={!originalFileBuffer}>
          <Download className="mr-1 h-4 w-4" /> Download Updated Spreadsheet
        </Button>
        <Button variant="outline" onClick={downloadCSV}>
          <Download className="mr-1 h-4 w-4" /> Download CSV Summary
        </Button>
        <Button variant="outline" onClick={() => {
          useAppStore.getState().setActiveSession(null);
          navigate('/upload');
        }}>
          Send another batch
        </Button>
      </div>
    </div>
  );
}
