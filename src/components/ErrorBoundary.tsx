
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
          <div className="max-w-md mx-auto text-center">
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-8">
              <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-500" />
              <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
              <p className="text-gray-400 mb-6">
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-neon-blue to-neon-cyan hover:from-neon-cyan hover:to-neon-blue"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
