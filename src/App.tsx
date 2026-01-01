import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './stores/useStore';
import { api } from './lib/api';
import type { User } from './types';

// Pages
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import ZooSelect from './pages/ZooSelect';
import Visit from './pages/Visit';
import Camera from './pages/Camera';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

import { colors } from './lib/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AppRoutes() {
  const user = useStore((state) => state.user);
  const isAuthLoading = useStore((state) => state.isAuthLoading);
  const setUser = useStore((state) => state.setUser);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await api.get<User | null>('/api/auth/me');
        setUser(userData);
      } catch {
        // Not authenticated or error - show welcome
        setUser(null);
      }
    };
    checkAuth();
  }, [setUser]);

  // Show loading spinner while checking auth
  if (isAuthLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors.cream,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          background: colors.forest,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          🦁
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }

  // If no user, show welcome screen
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/zoo-select" element={<ZooSelect />} />
      <Route path="/visit/:visitId" element={<Visit />} />
      <Route path="/camera" element={<Camera />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
