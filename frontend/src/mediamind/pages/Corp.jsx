import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import CorpRoleSelector from '../components/corp/CorpRoleSelector';
import { useAuth } from '../auth';
import { filterTabsForUser, defaultTabForUser } from '../lib/permissions';
import { CORP_TABS } from '../lib/corpTabs';

// Deep-link: o Assistente IA pode direcionar para /corp?tab=<id>.
// Lemos o parâmetro no mount e, se for uma aba permitida, ativamos ela.
import CorpGreeting from '../components/corp/CorpGreeting';
import ProdutoraPage from '../components/corp/roles/ProdutoraPage';
import EditorVideoPage from '../components/corp/roles/EditorVideoPage';
import VideomakerPage from '../components/corp/roles/VideomakerPage';
import RedacaoPage from '../components/corp/roles/RedacaoPage';
import DesignPage from '../components/corp/roles/DesignPage';
import AssessoriaPage from '../components/corp/roles/AssessoriaPage';
import AudiovisualPage from '../components/corp/roles/AudiovisualPage';
import RevistasPage from '../components/corp/roles/RevistasPage';
import EndomarketingPage from '../components/corp/roles/EndomarketingPage';
import DocumentacaoPage from '../components/corp/roles/DocumentacaoPage';
import CedocPage from '../components/corp/roles/CedocPage';
import ReporterPage from '../components/corp/roles/ReporterPage';
import ProdutorReportagemPage from '../components/corp/roles/ProdutorReportagemPage';
import DiretorProgramaPage from '../components/corp/roles/DiretorProgramaPage';
import EstagiarioPage from '../components/corp/roles/EstagiarioPage';
import ProgramacaoPage from '../components/corp/roles/ProgramacaoPage';
import QualidadePage from '../components/corp/roles/QualidadePage';
import GestaoPage from '../components/corp/roles/GestaoPage';
import ApresentadorPage from '../components/corp/roles/ApresentadorPage';
import LocutorPage from '../components/corp/roles/LocutorPage';
import SonoplastaPage from '../components/corp/roles/SonoplastaPage';
import FotografoPage from '../components/corp/roles/FotografoPage';
import MotionDesignerPage from '../components/corp/roles/MotionDesignerPage';
import CenografoPage from '../components/corp/roles/CenografoPage';
import RoteiristaPage from '../components/corp/roles/RoteiristaPage';
import RevisorPage from '../components/corp/roles/RevisorPage';
import TradutorPage from '../components/corp/roles/TradutorPage';
import SocialMediaPage from '../components/corp/roles/SocialMediaPage';
import CoordenadorComunicacaoPage from '../components/corp/roles/CoordenadorComunicacaoPage';
import JuridicoPage from '../components/corp/roles/JuridicoPage';
import TiSuportePage from '../components/corp/roles/TiSuportePage';
import AdminAcessosPage from '../components/corp/roles/AdminAcessosPage';
import CorpPromptLauncher from '../components/corp/CorpPromptLauncher';

const TABS = CORP_TABS;

export default function Corp() {
  const { user } = useAuth();
  const allowedTabs = filterTabsForUser(TABS, user);
  const firstAllowed = defaultTabForUser(TABS, user);
  const [activeTab, setActiveTab] = useState(firstAllowed || 'producao');
  const [searchParams] = useSearchParams();

  // Deep-link vindo do Assistente IA: /corp?tab=<id>. Aplica no mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && allowedTabs.some((t) => t.id === tab)) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gatilho do botão "Novo": /corp?novo=producao ativa a aba de produção.
  // Não limpa o param aqui — a ProdutoraPage lê, cria o rascunho e limpa.
  useEffect(() => {
    if (searchParams.get('novo') === 'producao') setActiveTab('producao');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Guarda a aba ativa: se o papel não tem acesso à aba atual (ex.: trocou de
  // usuário), volta para a primeira permitida. Negar por padrão = segurança.
  useEffect(() => {
    if (firstAllowed && !allowedTabs.some((t) => t.id === activeTab)) {
      setActiveTab(firstAllowed);
    }
  }, [firstAllowed, allowedTabs, activeTab]);

  function renderTab() {
    if (activeTab === 'editor_video') return <EditorVideoPage />;
    if (activeTab === 'videomaker') return <VideomakerPage />;
    if (activeTab === 'producao') return <ProdutoraPage />;
    if (activeTab === 'redacao') return <RedacaoPage />;
    if (activeTab === 'design') return <DesignPage />;
    if (activeTab === 'assessoria') return <AssessoriaPage />;
    if (activeTab === 'audiovisual') return <AudiovisualPage />;
    if (activeTab === 'revistas') return <RevistasPage />;
    if (activeTab === 'endomarketing') return <EndomarketingPage />;
    if (activeTab === 'documentacao') return <DocumentacaoPage />;
    if (activeTab === 'reporter') return <ReporterPage />;
    if (activeTab === 'produtor_reportagem') return <ProdutorReportagemPage />;
    if (activeTab === 'diretor_programa') return <DiretorProgramaPage />;
    if (activeTab === 'estagiario') return <EstagiarioPage />;
    if (activeTab === 'programacao') return <ProgramacaoPage />;
    if (activeTab === 'qualidade') return <QualidadePage />;
    if (activeTab === 'gestao') return <GestaoPage />;
    if (activeTab === 'cedoc') return <CedocPage />;
    if (activeTab === 'apresentador') return <ApresentadorPage />;
    if (activeTab === 'locutor') return <LocutorPage />;
    if (activeTab === 'sonoplasta') return <SonoplastaPage />;
    if (activeTab === 'fotografo') return <FotografoPage />;
    if (activeTab === 'motion_designer') return <MotionDesignerPage />;
    if (activeTab === 'cenografo') return <CenografoPage />;
    if (activeTab === 'roteirista') return <RoteiristaPage />;
    if (activeTab === 'revisor') return <RevisorPage />;
    if (activeTab === 'tradutor') return <TradutorPage />;
    if (activeTab === 'social_media') return <SocialMediaPage />;
    if (activeTab === 'coordenador_comunicacao') return <CoordenadorComunicacaoPage />;
    if (activeTab === 'juridico') return <JuridicoPage />;
    if (activeTab === 'ti_suporte') return <TiSuportePage />;
    if (activeTab === 'admin_acessos') return <AdminAcessosPage />;
    return null;
  }

  return (
    <div className="space-y-3 pb-8">
      <CorpGreeting />
      <div>
        <h1 className="text-xl font-bold text-slate-50">IAcervo Corp</h1>
      </div>

      <CorpRoleSelector tabs={allowedTabs} active={activeTab} onChange={setActiveTab} />

      {allowedTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 py-16 text-center">
          <Lock size={32} className="text-slate-600" />
          <p className="font-semibold text-slate-300">Sem acesso a este módulo</p>
          <p className="text-sm text-slate-500">Seu perfil não tem permissão para visualizar o IAcervo Corp. Contate o administrador.</p>
        </div>
      ) : (
        renderTab()
      )}
      <CorpPromptLauncher segment={activeTab} />
    </div>
  );
}