import { Link, useLocation } from 'react-router-dom';
import { Upload, Send, BarChart3, Settings, ShieldCheck } from 'lucide-react';

const navItems = [
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/send', label: 'Send', icon: Send },
  { to: '/results', label: 'Results', icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const httpSmsConfigured = Boolean(localStorage.getItem('httpsms_api_key') && localStorage.getItem('httpsms_from_number'));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/75 backdrop-blur-xl">
        <div className="section-shell flex items-center justify-between gap-4 py-4">
          <div>
            <Link to="/upload" className="font-display text-3xl text-foreground sm:text-4xl">
              Hugh's Pharmacy Text Messager
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">Patient outreach with direct SMS delivery and workflow tracking.</p>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-2">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-white/20 bg-white text-black'
                      : 'border-white/10 bg-white/5 text-foreground hover:bg-white/10'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <Link
              to="/settings"
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                location.pathname.startsWith('/settings')
                  ? 'border-white/20 bg-white text-black'
                  : 'border-white/10 bg-white/5 text-foreground hover:bg-white/10'
              }`}
              aria-label="Open settings"
            >
              {httpSmsConfigured ? <ShieldCheck className="h-4 w-4 text-[#11ff99]" /> : <Settings className="h-4 w-4" />}
              <span>Settings</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="section-shell py-8 sm:py-10">{children}</main>
    </div>
  );
}
