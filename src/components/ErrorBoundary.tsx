import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled application error', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
          <div className="rounded-2xl border border-destructive/20 bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The app hit an unexpected error. Your saved session should still be available.
            </p>
            <Button className="mt-6" onClick={this.handleReload}>
              Reload app
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
