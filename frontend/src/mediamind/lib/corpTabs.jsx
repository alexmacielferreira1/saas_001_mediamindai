import {
  PenLine, Palette, Clapperboard, FileText, Video, BookOpen, Megaphone, Scissors, Camera, ShieldCheck,
  Newspaper, ClipboardList, Tv, GraduationCap, CalendarClock, ClipboardCheck, BarChart3,
  Presentation, AudioLines, SlidersHorizontal, Aperture, Film, Frame, ScrollText, CheckCheck, Languages,
  Share2, Network, Scale, ServerCog, UserCog,
} from 'lucide-react';

// Catálogo canônico das abas/telas do IAcervo Corp. Usado pelo menu (Corp.jsx),
// pelo RBAC (permissions.js) e pela Administração de Acessos.
export const CORP_TABS = [
  { id: 'producao', name: 'Produção', Icon: Clapperboard },
  { id: 'videomaker', name: 'Videomaker', Icon: Camera },
  { id: 'editor_video', name: 'Editor de vídeo', Icon: Scissors },
  { id: 'reporter', name: 'Reporter', Icon: Newspaper },
  { id: 'produtor_reportagem', name: 'Produtor de reportagem', Icon: ClipboardList },
  { id: 'diretor_programa', name: 'Diretor de programa', Icon: Tv },
  { id: 'estagiario', name: 'Estagiário', Icon: GraduationCap },
  { id: 'programacao', name: 'Programação', Icon: CalendarClock },
  { id: 'qualidade', name: 'Controle de qualidade', Icon: ClipboardCheck },
  { id: 'redacao', name: 'Redação', Icon: PenLine },
  { id: 'design', name: 'Design', Icon: Palette },
  { id: 'assessoria', name: 'Assessoria de Imprensa', Icon: FileText },
  { id: 'audiovisual', name: 'Audiovisual', Icon: Video },
  { id: 'revistas', name: 'Revistas', Icon: BookOpen },
  { id: 'endomarketing', name: 'Endomarketing', Icon: Megaphone },
  { id: 'documentacao', name: 'Documentação', Icon: FileText },
  { id: 'gestao', name: 'Gestão', Icon: BarChart3 },
  { id: 'cedoc', name: 'Cedoc', Icon: ShieldCheck },
  { id: 'apresentador', name: 'Apresentador', Icon: Presentation },
  { id: 'locutor', name: 'Locutor', Icon: AudioLines },
  { id: 'sonoplasta', name: 'Sonoplasta', Icon: SlidersHorizontal },
  { id: 'fotografo', name: 'Fotógrafo', Icon: Aperture },
  { id: 'motion_designer', name: 'Motion Designer', Icon: Film },
  { id: 'cenografo', name: 'Cenógrafo', Icon: Frame },
  { id: 'roteirista', name: 'Roteirista', Icon: ScrollText },
  { id: 'revisor', name: 'Revisor', Icon: CheckCheck },
  { id: 'tradutor', name: 'Tradutor', Icon: Languages },
  { id: 'social_media', name: 'Social Media', Icon: Share2 },
  { id: 'coordenador_comunicacao', name: 'Coord. Comunicação', Icon: Network },
  { id: 'juridico', name: 'Jurídico', Icon: Scale },
  { id: 'ti_suporte', name: 'TI / Suporte', Icon: ServerCog },
  { id: 'admin_acessos', name: 'Administração', Icon: UserCog },
];

// Telas disponíveis para atribuição (exclui a própria tela de Administração,
// que só o admin enxerga). Usado pelos toggles de padrão/override.
export const CORP_SCREENS = CORP_TABS
  .filter((t) => t.id !== 'admin_acessos')
  .map(({ id, name }) => ({ id, name }));

export const SCREEN_NAME = Object.fromEntries(CORP_SCREENS.map((s) => [s.id, s.name]));