import { Link, useLocation } from 'react-router-dom';
import { Upload, Send, BarChart3, Settings } from 'lucide-react';

const navItems = [
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/send', label: 'Send', icon: Send },
  { to: '/results', label: 'Results', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/upload" className="font-display text-2xl text-primary">
            Hugh's Pharmacy Text Messager
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
