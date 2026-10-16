import { Toaster } from "@/components/ui/toaster";
import { useEffect, useState } from 'react';
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";

// MediaMind AI — frontend remontado (dados mockados centralizados)
import {
  AuthProvider as MmAuthProvider,
  useAuth as useMmAuth,
} from "./mediamind/auth";
import { EmpresaProvider, useEmpresa } from "./mediamind/lib/empresaContext";
import EmpresaGate from "./mediamind/components/EmpresaGate";
import Shell from "./mediamind/Shell";
import Login from "./mediamind/pages/Login";
import Home from "./mediamind/pages/Home";
import Acervo from "./mediamind/pages/Acervo";
import Management from "./mediamind/pages/Management";
import Administration2 from "./mediamind/pages/Administration2";
import Roteiro2 from "./mediamind/pages/Roteiro2";
import Corp from "./mediamind/pages/Corp";
import ViralClips from "./mediamind/pages/ViralClips";
import ClipsFree from "./mediamind/pages/ClipsFree";
import ClipsFree2 from "./mediamind/pages/ClipsFree2";
import Ingest from "./mediamind/pages/Ingest";
import Workspace2 from "./mediamind/pages/Workspace2";
import Timeline from "./mediamind/pages/Timeline";
import Timeline2 from "./mediamind/pages/Timeline2";
import SearchPage from "./mediamind/pages/Search";
import AssistenteIA from "./mediamind/pages/AssistenteIA";
import ThumbnailStudio from "./mediamind/pages/ThumbnailStudio";
import AITools from "./mediamind/pages/AITools";
import VideoGeneration from "./mediamind/pages/VideoGeneration";
import GraphicTools from "./mediamind/pages/GraphicTools";
import SoundCraft from "./mediamind/pages/SoundCraft";
import OfficeCraft from "./mediamind/pages/OfficeCraft";
import AISettings from "./mediamind/pages/AISettings";
import { canAccessModule } from "./mediamind/lib/moduleAccess";

const AuthenticatedApp = () => {
  const { loading: mmLoading } = useMmAuth();

  // Show loading spinner while checking app public settings or auth
  if (mmLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<MmProtectedRoute />}>
        <Route
          path="/"
          element={
            <Shell>
              <Home />
            </Shell>
          }
        />
        <Route
          path="/search"
          element={
            <Shell>
              <SearchPage />
            </Shell>
          }
        />
        <Route
          path="/ingest"
          element={
            <ModuleRoute moduleId="ingest">
              <Shell>
                <Ingest />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/workspace"
          element={
            <ModuleRoute moduleId="workspace">
              <Shell>
                <Workspace2 />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/workspace2"
          element={<Navigate to="/workspace" replace />}
        />
        <Route
          path="/workspace/timeline"
          element={
            <ModuleRoute moduleId="workspace">
              <Shell>
                <Workspace2 />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/timeline"
          element={
            <ModuleRoute moduleId="timeline">
              <Shell>
                <Timeline />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/timeline2"
          element={
            <ModuleRoute moduleId="timeline2">
              <Shell>
                <Timeline2 />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/social"
          element={
            <ModuleRoute moduleId="social">
              <Shell>
                <ViralClips />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route path="/clips" element={<Navigate to="/social" replace />} />
        <Route path="/publish" element={<Navigate to="/social" replace />} />
        <Route
          path="/clipsfree"
          element={
            <ModuleRoute moduleId="social">
              <Shell>
                <ClipsFree />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/clipsfree2"
          element={
            <ModuleRoute moduleId="social">
              <Shell>
                <ClipsFree2 />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/acervo"
          element={
            <ModuleRoute moduleId="acervo">
              <Shell>
                <Acervo />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/management"
          element={
            <ModuleRoute moduleId="management">
              <Shell>
                <Management />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/administration2"
          element={
            <ModuleRoute moduleId="management">
              <Shell>
                <Administration2 />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/roteiro2"
          element={
            <ModuleRoute moduleId="workspace">
              <Shell>
                <Roteiro2 />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/reports"
          element={<Navigate to="/management?tab=reports" replace />}
        />
        <Route
          path="/corp"
          element={
            <ModuleRoute moduleId="corp">
              <Shell>
                <Corp />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/assistente"
          element={
            <ModuleRoute moduleId="assistente">
              <Shell>
                <AssistenteIA />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/estudio-de-arte"
          element={
            <ModuleRoute moduleId="thumbnails">
              <Shell>
                <ThumbnailStudio />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/thumbnails"
          element={<Navigate to="/estudio-de-arte" replace />}
        />
        <Route
          path="/ferramentas-ia"
          element={
            <ModuleRoute moduleId="ai_tools">
              <Shell>
                <AITools />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/geracao-de-video"
          element={
            <ModuleRoute moduleId="ai_tools">
              <Shell>
                <VideoGeneration />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/ferramentas-graficas"
          element={
            <ModuleRoute moduleId="ai_tools">
              <Shell>
                <GraphicTools />
              </Shell>
            </ModuleRoute>
          }
        />
        <Route
          path="/soundcraft"
          element={<ModuleRoute moduleId="ai_tools"><></></ModuleRoute>}
        />
        <Route
          path="/ferramentas-office"
          element={<ModuleRoute moduleId="ai_tools"><Shell><OfficeCraft /></Shell></ModuleRoute>}
        />
        <Route
          path="/configuracoes/ia"
          element={<ModuleRoute moduleId="ai_tools"><Shell><AISettings /></Shell></ModuleRoute>}
        />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function ModuleRoute({ moduleId, children }) {
  const { user } = useMmAuth();
  return canAccessModule(user?.role, moduleId) ? (
    children
  ) : (
    <Navigate to="/" replace />
  );
}

function MmProtectedRoute() {
  const { user } = useMmAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <EmpresaProvider user={user}>
      <EmpresaGate>
        <PersistentSoundWorkspace />
      </EmpresaGate>
    </EmpresaProvider>
  );
}

function PersistentSoundWorkspace() {
  const { user } = useMmAuth();
  const { currentEmpresa } = useEmpresa();
  const location = useLocation();
  const visible = location.pathname === '/soundcraft' && canAccessModule(user?.role,'ai_tools');
  const [visited, setVisited] = useState(false);
  useEffect(() => { if(visible) setVisited(true); },[visible]);
  return <>
    <div hidden={visible}><Outlet /></div>
    {(visible || visited) && canAccessModule(user?.role,'ai_tools') && <div hidden={!visible} key={`${user.id}:${currentEmpresa?.id || 'global'}`}><Shell persistentPath="/soundcraft"><SoundCraft /></Shell></div>}
  </>;
}

function App() {
  return (
    <MmAuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </MmAuthProvider>
  );
}

export default App;
