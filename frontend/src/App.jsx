import { Toaster } from "@/components/ui/toaster";
import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";

import { AuthProvider as MmAuthProvider, useAuth as useMmAuth } from "./mediamind/auth";
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
import DarkChannels from "./mediamind/pages/DarkChannels";
import AgenciaVideo from "./mediamind/pages/AgenciaVideo";
import GraphicTools from "./mediamind/pages/GraphicTools";
import SoundCraft from "./mediamind/pages/SoundCraft";
import OfficeCraft from "./mediamind/pages/OfficeCraft";
import AISettings from "./mediamind/pages/AISettings";
import AIUsageDashboard from "./mediamind/pages/AIUsageDashboard";
import { canAccessModule } from "./mediamind/lib/moduleAccess";

function ModuleRoute({ moduleId, children }) {
  const { user } = useMmAuth();
  return canAccessModule(user?.role, moduleId) ? children : <Navigate to="/" replace />;
}

function MmProtectedRoute() {
  const { user } = useMmAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <EmpresaProvider user={user}>
      <EmpresaGate><PersistentSoundWorkspace /></EmpresaGate>
    </EmpresaProvider>
  );
}

function PersistentSoundWorkspace() {
  const { user } = useMmAuth();
  const { currentEmpresa } = useEmpresa();
  const location = useLocation();
  const visible = location.pathname === "/soundcraft" && canAccessModule(user?.role, "ai_tools");
  const [visited, setVisited] = useState(false);
  useEffect(() => { if (visible) setVisited(true); }, [visible]);
  return <>
    <div hidden={visible}><Outlet /></div>
    {(visible || visited) && canAccessModule(user?.role, "ai_tools") && (
      <div hidden={!visible} key={`${user.id}:${currentEmpresa?.id || "global"}`}>
        <Shell persistentPath="/soundcraft"><SoundCraft /></Shell>
      </div>
    )}
  </>;
}

function AuthenticatedApp() {
  const { loading: mmLoading } = useMmAuth();
  if (mmLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
    </div>;
  }
  const protectedPage = (Component, moduleId) => {
    const content = <Shell><Component /></Shell>;
    return moduleId ? <ModuleRoute moduleId={moduleId}>{content}</ModuleRoute> : content;
  };
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<MmProtectedRoute />}>
      <Route path="/" element={protectedPage(Home)} />
      <Route path="/search" element={protectedPage(SearchPage)} />
      <Route path="/ingest" element={protectedPage(Ingest, "ingest")} />
      <Route path="/workspace" element={protectedPage(Workspace2, "workspace")} />
      <Route path="/workspace2" element={<Navigate to="/workspace" replace />} />
      <Route path="/workspace/timeline" element={protectedPage(Workspace2, "workspace")} />
      <Route path="/timeline" element={protectedPage(Timeline, "timeline")} />
      <Route path="/timeline2" element={protectedPage(Timeline2, "timeline2")} />
      <Route path="/social" element={protectedPage(ViralClips, "social")} />
      <Route path="/clips" element={<Navigate to="/social" replace />} />
      <Route path="/publish" element={<Navigate to="/social" replace />} />
      <Route path="/clipsfree" element={protectedPage(ClipsFree, "social")} />
      <Route path="/clipsfree2" element={protectedPage(ClipsFree2, "social")} />
      <Route path="/acervo" element={protectedPage(Acervo, "acervo")} />
      <Route path="/management" element={protectedPage(Management, "management")} />
      <Route path="/administration2" element={protectedPage(Administration2, "management")} />
      <Route path="/roteiro2" element={protectedPage(Roteiro2, "workspace")} />
      <Route path="/reports" element={<Navigate to="/management?tab=reports" replace />} />
      <Route path="/corp" element={protectedPage(Corp, "corp")} />
      <Route path="/assistente" element={protectedPage(AssistenteIA, "assistente")} />
      <Route path="/estudio-de-arte" element={protectedPage(ThumbnailStudio, "thumbnails")} />
      <Route path="/thumbnails" element={<Navigate to="/estudio-de-arte" replace />} />
      <Route path="/ferramentas-ia" element={protectedPage(AITools, "ai_tools")} />
      <Route path="/geracao-de-video" element={protectedPage(VideoGeneration, "ai_tools")} />
        <Route path="/canais-dark" element={protectedPage(DarkChannels, "ai_tools")} />
        <Route path="/video-estudio" element={<Navigate to="/canais-dark" replace />} />
      <Route path="/agencia-video" element={protectedPage(AgenciaVideo, "ai_tools")} />
      <Route path="/ferramentas-graficas" element={protectedPage(GraphicTools, "ai_tools")} />
      <Route path="/soundcraft" element={<ModuleRoute moduleId="ai_tools"><></></ModuleRoute>} />
      <Route path="/ferramentas-office" element={protectedPage(OfficeCraft, "ai_tools")} />
      <Route path="/dash-ias" element={protectedPage(AIUsageDashboard)} />
      <Route path="/configuracoes/ia" element={protectedPage(AISettings, "ai_tools")} />
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>;
}

export default function App() {
  return <MmAuthProvider>
    <QueryClientProvider client={queryClientInstance}>
      <Router><ScrollToTop /><AuthenticatedApp /></Router>
      <Toaster />
    </QueryClientProvider>
  </MmAuthProvider>;
}
