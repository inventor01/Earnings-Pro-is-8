import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './lib/themeContext';
import { AuthProvider, useAuth } from './lib/authContext';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { useState, useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'leaderboard'>('dashboard');

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
    : <Dashboard onNavigateToLeaderboard={() => setCurrentPage('leaderboard')} />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
