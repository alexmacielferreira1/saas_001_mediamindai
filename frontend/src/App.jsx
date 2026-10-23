import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense, useEffect, useState } from "react";
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
import { canAccessModule } from "./mediamind/lib/moduleAccess";

// Páginas carregadas sob demanda (auditoria 2026-10-23, #15): login e home não baixam os
// editores gráficos e de vídeo no chunk inicial.
const Home = lazy(() => import("./mediamind/pages/Home"));
const Acervo = lazy(() => import("./mediamind/pages/Acervo"));
const Management = lazy(() => import("./mediamind/pages/Management"));
const Administration2 = lazy(() => import("./mediamind/pages/Administration2"));
const Roteiro2 = lazy(() => import("./mediamind/pages/Roteiro2"));
const Corp = lazy(() => import("./mediamind/pages/Corp"));
const ViralClips = lazy(() => import("./mediamind/pages/ViralClips"));
const ClipsFree = lazy(() => import("./mediamind/pages/ClipsFree"));
const ClipsFree2 = lazy(() => import("./mediamind/pages/ClipsFree2"));
const Ingest = lazy(() => import("./mediamind/pages/Ingest"));
const Workspace2 = lazy(() => import("./mediamind/pages/Workspace2"));
const Timeline = lazy(() => import("./mediamind/pages/Timeline"));
const Timeline2 = lazy(() => import("./mediamind/pages/Timeline2"));
const SearchPage = lazy(() => import("./mediamind/pages/Search"));
const AssistenteIA = lazy(() => import("./mediamind/pages/AssistenteIA"));
const ThumbnailStudio = lazy(() => import("./mediamind/pages/ThumbnailStudio"));
const AITools = lazy(() => import("./mediamind/pages/AITools"));
const VideoGeneration = lazy(() => import("./mediamind/pages/VideoGeneration"));
const DarkChannels = lazy(() => import("./mediamind/pages/DarkChannels"));
const AgenciaVideo = lazy(() => import("./mediamind/pages/AgenciaVideo"));
const GraphicTools = lazy(() => import("./mediamind/pages/GraphicTools"));
const SoundCraft = lazy(() => import("./mediamind/pages/SoundCraft"));
const OfficeCraft = lazy(() => import("./mediamind/pages/OfficeCraft"));
const AISettings = lazy(() => import("./mediamind/pages/AISettings"));
const AIUsageDashboard = lazy(() => import("./mediamind/pages/AIUsageDashboard"));
const Telas2 = lazy(() => import("./mediamind/pages/Telas2"));
const Gestao2 = lazy(() => import("./mediamind/pages/Gestao2"));
const APIsIA2 = lazy(() => import("./mediamind/pages/APIsIA2"));

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
        <Shell persistentPath="/soundcraft"><Suspense fallback={null}><SoundCraft /></Suspense></Shell>
      </div>
    )}
  </>;
}

function PageLoading() {
  return <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
  </div>;
}

function InlinePageLoading() {
  return <div className="flex h-full min-h-[50vh] items-center justify-center" role="status" aria-label="Carregando página">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
  </div>;
}

function AuthenticatedApp() {
  const { loading: mmLoading } = useMmAuth();
  if (mmLoading) {
    return <PageLoading />;
  }
  const protectedPage = (Component, moduleId) => {
    // Suspense dentro do Shell: a navegação mantém menu e cabeçalho enquanto a página carrega.
    const content = <Shell><Suspense fallback={<InlinePageLoading />}><Component /></Suspense></Shell>;
    return moduleId ? <ModuleRoute moduleId={moduleId}>{content}</ModuleRoute> : content;
  };
  return <Suspense fallback={<PageLoading />}><Routes>
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
      <Route path="/publish" element={<Navigate to="/corp?tab=producao&sub=para_publicar" replace />} />
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
        <Route path="/canais-dark-2" element={<Navigate to="/canais-dark" replace />} />
        <Route path="/video-estudio" element={<Navigate to="/canais-dark" replace />} />
      <Route path="/agencia-video" element={protectedPage(AgenciaVideo, "ai_tools")} />
      <Route path="/ferramentas-graficas" element={protectedPage(GraphicTools, "ai_tools")} />
      <Route path="/soundcraft" element={<ModuleRoute moduleId="ai_tools"><></></ModuleRoute>} />
      <Route path="/ferramentas-office" element={protectedPage(OfficeCraft, "ai_tools")} />
      <Route path="/dash-ias" element={protectedPage(AIUsageDashboard)} />
      <Route path="/telas2" element={protectedPage(Telas2, "management")} />
      <Route path="/telas2/gestao" element={protectedPage(Gestao2, "management")} />
      <Route path="/telas2/apis-ia" element={protectedPage(APIsIA2, "management")} />
      <Route path="/configuracoes/ia" element={protectedPage(AISettings, "ai_tools")} />
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes></Suspense>;
}

export default function App() {
  return <MmAuthProvider>
    <QueryClientProvider client={queryClientInstance}>
      <Router><ScrollToTop /><AuthenticatedApp /></Router>
      <Toaster />
    </QueryClientProvider>
  </MmAuthProvider>;
}
