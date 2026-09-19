import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';

// MediaMind AI — frontend remontado (dados mockados centralizados)
import { AuthProvider as MmAuthProvider, useAuth as useMmAuth } from './mediamind/auth';
import { EmpresaProvider } from './mediamind/lib/empresaContext';
import EmpresaGate from './mediamind/components/EmpresaGate';
import Shell from './mediamind/Shell';
import Login from './mediamind/pages/Login';
import Home from './mediamind/pages/Home';
import Acervo from './mediamind/pages/Acervo';
import Management from './mediamind/pages/Management';
import Corp from './mediamind/pages/Corp';
import ViralClips from './mediamind/pages/ViralClips';
import Ingest from './mediamind/pages/Ingest';
import Workspace from './mediamind/pages/Workspace';
import Timeline from './mediamind/pages/Timeline';
import SearchPage from './mediamind/pages/Search';
import AssistenteIA from './mediamind/pages/AssistenteIA';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const { loading: mmLoading } = useMmAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth || mmLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }
  // auth_required from platform auth falls through to routes —
  // the MediaMind mock auth gate (MmProtectedRoute) handles login redirect.

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<MmProtectedRoute />}>
        <Route path="/" element={<Shell><Home /></Shell>} />
        <Route path="/search" element={<Shell><SearchPage /></Shell>} />
        <Route path="/ingest" element={<Shell><Ingest /></Shell>} />
        <Route path="/workspace" element={<Shell><Workspace /></Shell>} />
        <Route path="/workspace/timeline" element={<Shell><Workspace /></Shell>} />
        <Route path="/timeline" element={<Shell><Timeline /></Shell>} />
        <Route path="/social" element={<Shell><ViralClips /></Shell>} />
        <Route path="/clips" element={<Navigate to="/social" replace />} />
        <Route path="/publish" element={<Navigate to="/social" replace />} />
        <Route path="/acervo" element={<Shell><Acervo /></Shell>} />
        <Route path="/management" element={<Shell><Management /></Shell>} />
        <Route path="/reports" element={<Navigate to="/management?tab=reports" replace />} />
        <Route path="/corp" element={<Shell><Corp /></Shell>} />
        <Route path="/assistente" element={<Shell><AssistenteIA /></Shell>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function MmProtectedRoute() {
  const { user } = useMmAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <EmpresaProvider user={user}>
      <EmpresaGate>
        <Outlet />
      </EmpresaGate>
    </EmpresaProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <MmAuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </MmAuthProvider>
    </AuthProvider>
  )
}

export default App