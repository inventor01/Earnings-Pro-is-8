import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './lib/themeContext';
import { AuthProvider, useAuth } from './lib/authContext';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { useState, useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function getResetToken(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const path = window.location.pathname;
  if (path === '/reset-password' || path.includes('reset-password')) {
    return urlParams.get('token');
  }
  return null;
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'leaderboard'>('dashboard');
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const token = getResetToken();
    if (token) {
      setResetToken(token);
    }
  }, []);

  const handleBackFromReset = () => {
    setResetToken(null);
    window.history.pushState({}, '', '/');
  };

  if (resetToken) {
    return <ResetPasswordPage token={resetToken} onBack={handleBackFromReset} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="text-center">
          <div className="text-6xl mb-4">🚗</div>
          <p className="text-cyan-400 text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  return currentPage === 'leaderboard' 
    ? <LeaderboardPage onBack={() => setCurrentPage('dashboard')} />
    : <Dashboard />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider queryClient={queryClient}>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
