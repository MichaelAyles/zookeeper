import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './stores/useStore';

// Pages
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import ZooSelect from './pages/ZooSelect';
import Visit from './pages/Visit';
import Camera from './pages/Camera';
import Stats from './pages/Stats';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AppRoutes() {
  const profile = useStore((state) => state.profile);

  // If no profile, show welcome screen
  if (!profile) {
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
