// ============================================================================
// MediaMind AI — Camada de dados mockados (centralizada)
// ----------------------------------------------------------------------------
// Tudo aqui é DADO DE EXEMPLO para demonstração/validação visual.
// O backend real (Python/FastAPI) não está conectado nesta etapa.
// Para integrar o backend real, substituir as funções de deste arquivo
// por chamadas reais aos endpoints (preservando os mesmos contratos).
// Cada seção está identificada com o endpoint correspondente do backend.
// ============================================================================

// --- /auth (POST /auth/token) ---
export const MOCK_USERS = [
  // Senhas removidas do bundle — autenticação agora é real (Base44).
  // Esta lista só serve de exemplo para a tela de Administração de Acessos
  // (listagem de funcionários); não é usada para login.
  { id: 1, username: 'admin', email: 'admin@mediamind.ai', name: 'Ana Souza', role: 'admin', group_name: 'Administradores', status: 'active', restricted_screens: null },
  { id: 2, username: 'editor', email: 'editor@mediamind.ai', name: 'Carlos Lima', role: 'editor', group_name: 'Edição', status: 'active', restricted_screens: null },
  { id: 3, username: 'produtor', email: 'produtor@mediamind.ai', name: 'Marina Alves', role: 'producer', group_name: 'Produção', status: 'active', restricted_screens: null },
  { id: 4, username: 'cedoc', email: 'cedoc@mediamind.ai', name: 'Maria Oliveira', role: 'cedoc', group_name: 'CEDOC', status: 'active', restricted_screens: null },
];

export const USER_ROLE_LABELS = {
  viewer: 'Visitante', mvp: 'MVP', producer: 'Produtor', editor: 'Editor',
  journalist: 'Jornalista', cedoc: 'CEDOC', admin: 'Administrador',
};

// --- /projects (GET /projects/) ---
export const MOCK_PROJECTS = [
  { id: 1, name: 'Jornal do Meio Dia', status: 'active', asset_count: 128, created_at: '2026-08-15' },
  { id: 2, name: 'Especial Enchentes RS', status: 'active', asset_count: 354, created_at: '2026-08-20' },
  { id: 3, name: 'Entrevistas Economia', status: 'active', asset_count: 212, created_at: '2026-09-01' },
  { id: 4, name: 'Documentário Turismo', status: 'completed', asset_count: 87, created_at: '2026-07-10' },
  { id: 5, name: 'Campanha Institucional', status: 'active', asset_count: 64, created_at: '2026-09-05' },
];

// --- /scripts (GET /scripts/) ---
export const MOCK_SCRIPTS = [
  { id: 1, title: 'Jornal 15h — 15/05', status: 'in_review', clip_count: 18, duration_label: '03:24', project_name: 'Jornal do Meio Dia' },
  { id: 2, title: 'Matéria Enchentes', status: 'approved', clip_count: 32, duration_label: '07:18', project_name: 'Especial Enchentes RS' },
  { id: 3, title: 'Especial Educação', status: 'draft', clip_count: 22, duration_label: '04:57', project_name: 'Jornal do Meio Dia' },
  { id: 4, title: 'Turismo RS', status: 'in_review', clip_count: 28, duration_label: '05:33', project_name: 'Documentário Turismo' },
];

// --- /assets (GET /assets/) ---
export const MOCK_ASSETS = [
  { id: 1, project_id: 1, filename: 'ENTREVISTA_PREFEITO_RS.mov', asset_type: 'video', status: 'reviewed', duration: 765, title: 'Entrevista Prefeito', description: 'Entrevista sobre revitalização do Centro Histórico.', category: 'Entrevista', location: 'Porto Alegre - RS', icon: '🎙️', people: 'Prefeito, repórter', subjects: 'revitalização, centro histórico, obras', ai_status: 'complete', program_name: 'Jornal do Meio Dia', reference_date: '2026-06-15', file_size: 1320000000, path: '/media/entrevista.mov' },
  { id: 2, project_id: 1, filename: 'DRONE_CENTRO_HISTORICO.mov', asset_type: 'video', status: 'indexed', duration: 317, title: 'Drone Centro Histórico', description: 'Imagens aéreas do Centro Histórico.', category: 'Drone', location: 'Porto Alegre - RS', icon: '🚁', subjects: 'centro histórico, trânsito', ai_status: 'complete', program_name: 'Jornal do Meio Dia', reference_date: '2026-06-14', file_size: 1860000000 },
  { id: 3, project_id: 1, filename: 'COMERCIANTES_CENTRO.mp4', asset_type: 'video', status: 'reviewed', duration: 501, title: 'Comerciantes comentam mudanças', description: 'Depoimentos de comerciantes sobre fluxo no Centro.', category: 'Entrevista', location: 'Centro Histórico', icon: '🧑‍💼', people: 'Comerciantes', subjects: 'comércio local, revitalização', ai_status: 'complete', program_name: 'Jornal do Meio Dia', reference_date: '2026-06-13', file_size: 812000000 },
  { id: 4, project_id: 2, filename: 'RELATORIO_TURISMO_CENTRO.pdf', asset_type: 'document', status: 'indexed', duration: 0, title: 'Relatório Turismo Centro', description: 'Documento com dados sobre turismo urbano.', category: 'Documento', location: 'Porto Alegre - RS', icon: '📄', subjects: 'turismo, eventos', ai_status: 'complete', program_name: 'Documentário Turismo', reference_date: '2026-06-12', file_size: 18000000 },
  { id: 5, project_id: 2, filename: 'OBRAS_REVITALIZACAO.mp4', asset_type: 'video', status: 'processing', duration: 363, title: 'Obras de Revitalização', description: 'Imagens de apoio das obras.', category: 'Imagem de apoio', location: 'Porto Alegre - RS', icon: '🏗️', people: 'Operários', subjects: 'obras, revitalização', ai_status: 'pending', program_name: 'Jornal do Meio Dia', reference_date: '2026-06-11', file_size: 645000000 },
  { id: 6, project_id: 1, filename: 'ENTREVISTA_FESTIVAL_INOVACAO.mov', asset_type: 'video', status: 'ready', duration: 154, title: 'Entrevista - Festival de Inovação', description: 'Entrevista com organizadores do festival de inovação.', category: 'Entrevista', location: 'Porto Alegre - RS', icon: '🎬', people: 'Organizadores', subjects: 'festival, inovação, tecnologia', ai_status: 'complete', program_name: 'Jornal do Meio Dia', reference_date: '2026-09-08', file_size: 920000000 },
  { id: 7, project_id: 1, filename: 'BROLL_CIDADE_AMANHECER.mov', asset_type: 'video', status: 'indexed', duration: 78, title: 'B-roll - Cidade ao amanhecer', description: 'Imagens da cidade ao nascer do sol.', category: 'Imagem de apoio', location: 'Porto Alegre - RS', icon: '🏙️', people: '', subjects: 'cidade, amanhecer, paisagem', ai_status: 'complete', program_name: 'Jornal do Meio Dia', reference_date: '2026-09-07', file_size: 540000000 },
  { id: 8, project_id: 1, filename: 'AUDIO_TRILHA_INSTITUCIONAL.mp3', asset_type: 'audio', status: 'ready', duration: 222, title: 'Áudio base - trilha institucional', description: 'Trilha sonora de apoio institucional.', category: 'Áudio', location: '—', icon: '🎧', people: '', subjects: 'trilha, áudio, institucional', ai_status: 'complete', program_name: 'Campanha Institucional', reference_date: '2026-09-06', file_size: 85000000 },
];

// --- /tasks (GET /tasks/) ---
export const MOCK_TASKS = [
  { id: 1, title: 'Editar matéria Centro Histórico', status: 'in_progress', assigned_to_id: 2, project_name: 'Jornal do Meio Dia', priority: 'high', due_date: '2026-09-13' },
  { id: 2, title: 'Revisar roteiro Enchentes', status: 'delivered', assigned_to_id: 2, project_name: 'Especial Enchentes RS', priority: 'high', due_date: '2026-09-12' },
  { id: 3, title: 'Cortar vídeo para Instagram', status: 'not_started', assigned_to_id: 2, project_name: 'Jornal do Meio Dia', priority: 'medium', due_date: '2026-09-14' },
  { id: 4, title: 'Indexar material de apoio', status: 'in_progress', assigned_to_id: 2, project_name: 'Documentário Turismo', priority: 'low', due_date: '2026-09-15' },
  { id: 5, title: 'Aprovar edição final', status: 'approved', assigned_to_id: 2, project_name: 'Campanha Institucional', priority: 'high', due_date: '2026-09-10' },
];

// --- /saved-searches (GET /saved-searches/) ---
export const MOCK_SAVED_SEARCHES = [
  { id: 1, title: 'chuva em porto alegre', type: 'Vídeos', date: '15/05/2026' },
  { id: 2, title: 'entrevistas prefeito joão', type: 'Entrevistas', date: '14/05/2026' },
  { id: 3, title: 'imagens centro da cidade', type: 'Imagens', date: '13/05/2026' },
  { id: 4, title: 'economia e inflação', type: 'Documentos', date: '12/05/2026' },
];

// --- /reports/recent-activity ---
export const MOCK_RECENT_ACTIVITY = [
  { id: 1, kind: 'asset_uploaded', title: 'ENTREVISTA_PREFEITO_RS.mov', detail: 'Upload concluído', time: 'há 2 min' },
  { id: 2, kind: 'asset_uploaded', title: 'DRONE_CENTRO_HISTORICO.mov', detail: 'Upload concluído', time: 'há 5 min' },
  { id: 3, kind: 'task_updated', title: 'Matéria Enchentes', detail: 'Status → Em revisão', time: 'há 12 min' },
  { id: 4, kind: 'publication_published', title: 'Corte — Entrevista Prefeito', detail: 'Publicado no Instagram', time: 'há 20 min' },
];

// --- /libraries (GET /libraries/) ---
export const MOCK_LIBRARIES = [
  { id: 1, name: 'Jornalismo', description: 'Produção jornalística diária', status: 'active', asset_count: 7294, storage_bytes: 12400000000000, created_at: '2026-01-01', last_backup_at: '2026-09-08', last_audit_at: '2026-09-08' },
  { id: 2, name: 'Entrevistas', description: 'Acervo de entrevistas', status: 'active', asset_count: 2198, storage_bytes: 4800000000000, created_at: '2026-01-01', last_backup_at: '2026-09-08', last_audit_at: '2026-09-07' },
  { id: 3, name: 'Arquivo Histórico', description: 'Preservação de material histórico', status: 'warning', asset_count: 4387, storage_bytes: 18200000000000, created_at: '2025-06-01', last_backup_at: '2026-09-07', last_audit_at: '2026-09-06' },
  { id: 4, name: 'Institucional', description: 'Material corporativo', status: 'active', asset_count: 1482, storage_bytes: 3100000000000, created_at: '2026-01-01', last_backup_at: '2026-09-08', last_audit_at: '2026-09-08' },
  { id: 5, name: 'Eventos', description: 'Cobertura de eventos', status: 'active', asset_count: 3181, storage_bytes: 7600000000000, created_at: '2026-01-01', last_backup_at: '2026-09-08', last_audit_at: '2026-09-07' },
];

// --- /audit-logs (GET /audit-logs/) ---
export const MOCK_AUDIT_LOGS = [
  { id: 1, action: 'Upload', asset: 'ENTREVISTA_PREFEITO_RS.mov', user: 'João Silva', date: 'Hoje 09:12' },
  { id: 2, action: 'Indexação IA', asset: 'DRONE_CENTRO_HISTORICO.mov', user: 'Sistema', date: 'Hoje 08:44' },
  { id: 3, action: 'Exportação', asset: 'ROTEIRO_ENCHENTES.docx', user: 'Carlos Souza', date: 'Ontem 17:30' },
  { id: 4, action: 'Falha OCR', asset: 'RELATORIO_TURISMO.pdf', user: 'Sistema', date: 'Ontem 13:10' },
];

// --- /monitoring (GET /monitoring) ---
export const MOCK_MONITORING = {
  processing: 3,
  completed: 14808,
  failed: 37,
  services: [
    { key: 'api', label: 'API MediaMind', status: 'ok', detail: 'Respondendo' },
    { key: 'whisper', label: 'Whisper (Transcrição)', status: 'ok', detail: 'Ativo' },
    { key: 'ocr', label: 'OCR (Tesseract)', status: 'ok', detail: 'Ativo' },
    { key: 'yolo', label: 'YOLO (Objetos)', status: 'warning', detail: 'Fila acima do normal' },
    { key: 'storage', label: 'Storage', status: 'ok', detail: '72% usado' },
  ],
  ai_models: [
    { key: 'whisper-large', label: 'Whisper Large v3', status: 'ok', detail: 'Carregado' },
    { key: 'yolov8', label: 'YOLOv8', status: 'ok', detail: 'Carregado' },
    { key: 'ocr', label: 'Tesseract OCR', status: 'ok', detail: 'Carregado' },
  ],
  resources: { cpu_logical_cores: 8, cpu_percent: 34, memory_used_bytes: 12000000000, memory_total_bytes: 32000000000, gpu_percent: 56, gpu_memory_used_bytes: 4000000000, gpu_memory_total_bytes: 8000000000 },
  storage: { path: '/data/storage', used_bytes: 36000000000000, total_bytes: 50000000000000, free_bytes: 14000000000000 },
};

// --- /ingest-packages (GET /ingest-packages/) ---
export const MOCK_INGEST_PACKAGES = [
  { id: 1, name: 'Revitalização do Centro Histórico', status: 'processing', file_count: 5, created_at: '2026-09-11 09:15', owner: 'Ana Souza', progress: 68 },
  { id: 2, name: 'Documentos Institucionais', status: 'failed', file_count: 1, created_at: '2026-09-11 11:10', owner: 'Ana Souza', progress: 22 },
  { id: 3, name: 'Festival de Inovação — Cobertura', status: 'completed', file_count: 12, created_at: '2026-09-10 14:00', owner: 'Carlos Lima', progress: 100 },
  { id: 4, name: 'Entrevistas Economia — Lote 2', status: 'queued', file_count: 3, created_at: '2026-09-11 13:30', owner: 'Marina Alves', progress: 0 },
];

// --- /clips (GET /clips/) ---
export const MOCK_CLIPS = [
  { id: 1, title: 'Corte — Prefeito fala sobre obras', status: 'ready', duration: 45, file_size: 24000000, editor: 'Carlos Lima', program_name: 'Jornal do Meio Dia', channels: 'instagram,youtube', source_asset_id: 1 },
  { id: 2, title: 'Corte — Drone centro ao entardecer', status: 'sent_to_publish', duration: 30, file_size: 18000000, editor: 'Carlos Lima', program_name: 'Jornal do Meio Dia', channels: 'tiktok,instagram', source_asset_id: 2 },
  { id: 3, title: 'Corte — Comerciantes reclamam', status: 'draft', duration: 60, file_size: 32000000, editor: '—', program_name: 'Jornal do Meio Dia', channels: '', source_asset_id: 3 },
];

// --- /publications (GET /publications/) ---
export const MOCK_PUBLICATIONS = [
  { id: 1, platform: 'instagram', status: 'published', title: 'Corte — Prefeito fala sobre obras', published_at: '2026-09-10 18:00', clip_id: 1, views: 4200, likes: 380 },
  { id: 2, platform: 'youtube', status: 'published', title: 'Corte — Prefeito fala sobre obras', published_at: '2026-09-10 18:05', clip_id: 1, views: 1850, likes: 92 },
  { id: 3, platform: 'tiktok', status: 'published', title: 'Corte — Drone centro ao entardecer', published_at: '2026-09-09 15:00', clip_id: 2, views: 12300, likes: 1100 },
  { id: 4, platform: 'instagram', status: 'pending_review', title: 'Corte — Drone centro ao entardecer', published_at: null, clip_id: 2, views: 0, likes: 0 },
];

export const PUBLICATION_PLATFORM_LABELS = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook',
};
export const PUBLICATION_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook'];

// --- /reports/* ---
export const MOCK_TEAM_PERFORMANCE = [
  { user: 'Ana Souza', role: 'Administrador', tasks_completed: 18, tasks_total: 20, avg_delivery_days: 1.2, approval_rate: 95 },
  { user: 'Carlos Lima', role: 'Editor', tasks_completed: 24, tasks_total: 33, avg_delivery_days: 2.8, approval_rate: 72 },
  { user: 'Marina Alves', role: 'Produtora', tasks_completed: 15, tasks_total: 21, avg_delivery_days: 2.1, approval_rate: 80 },
  { user: 'Maria Oliveira', role: 'CEDOC', tasks_completed: 12, tasks_total: 15, avg_delivery_days: 1.5, approval_rate: 90 },
];

export const MOCK_TEAM_WORKLOAD = [
  { name: 'Ana Souza', role: 'Administrador', active_tasks: 4, deadline_risk: 'Baixo' },
  { name: 'Carlos Lima', role: 'Editor', active_tasks: 9, deadline_risk: 'Alto' },
  { name: 'Marina Alves', role: 'Produtora', active_tasks: 6, deadline_risk: 'Médio' },
  { name: 'Maria Oliveira', role: 'CEDOC', active_tasks: 3, deadline_risk: 'Baixo' },
];

export const MOCK_PUBLICATION_SUMMARY = {
  total_published: 24,
  total_scheduled: 6,
  total_pending: 3,
  avg_approval_rate: 78,
};

export const MOCK_PUBLICATION_CALENDAR = [
  { date: '18/09', title: 'Especial Enchentes — parte 2', platform: 'youtube', status: 'Agendado' },
  { date: '19/09', title: 'Corte — Entrevista Prefeito', platform: 'instagram', status: 'Agendado' },
  { date: '20/09', title: 'Documentário Turismo (trailer)', platform: 'tiktok', status: 'Rascunho' },
  { date: '21/09', title: 'Entrevista Economia — trecho', platform: 'youtube', status: 'Rascunho' },
];

export const MOCK_SOCIAL_METRICS = [
  { platform: 'Instagram', followers: '182k', engagement: '4.2%', published: 12, views: '124k' },
  { platform: 'YouTube', followers: '48k', engagement: '3.1%', published: 8, views: '92k' },
  { platform: 'TikTok', followers: '310k', engagement: '6.8%', published: 18, views: '890k' },
  { platform: 'Facebook', followers: '32k', engagement: '2.1%', published: 4, views: '18k' },
];

// --- Corp (mock — sem backend) ---
export const MOCK_CORP_PROJECTS = [
  { titulo: 'Release — resultado trimestral', segmento: 'Assessoria de Imprensa', status: 'Em revisão', prazo: '23/09', responsavel: 'Você' },
  { titulo: 'Arte — campanha institucional', segmento: 'Design', status: 'Aguardando aprovação', prazo: '25/09', responsavel: 'Você' },
  { titulo: 'Gravação — entrevista diretoria', segmento: 'Produção', status: 'Agendado', prazo: '27/09', responsavel: 'Equipe Audiovisual' },
  { titulo: 'Edição — revista trimestral #12', segmento: 'Revistas', status: 'Em produção', prazo: '30/09', responsavel: 'Equipe Editorial' },
];

// --- IAcervo Corp — Produções (Conteúdo Mestre) ---
export const MOCK_CORP_PRODUCTIONS = [
  { id: 1, programa: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', status: 'em_edicao', data_gravacao: '2026-07-15', data_publicacao: '2026-07-17', responsavel: 'Claudia' },
  { id: 2, programa: 'Fronteiras da Saúde', episodio: 'EP053', titulo: 'Desafios do SUS', status: 'aprovado', data_gravacao: '2026-07-14', data_publicacao: '2026-07-16', responsavel: 'Ana' },
  { id: 3, programa: 'Opinião Simers', episodio: 'EP052', titulo: 'Entrevista mensal', status: 'aguardando_aprovacao', data_gravacao: '2026-07-12', data_publicacao: '2026-07-18', responsavel: 'Rafael' },
  { id: 4, programa: 'No Front', episodio: 'EP051', titulo: 'Inovação em saúde', status: 'em_producao', data_gravacao: '2026-07-10', data_publicacao: '2026-07-20', responsavel: 'Bianca' },
  { id: 5, programa: 'Corações e Mentes', episodio: 'EP050', titulo: 'Saúde mental no trabalho', status: 'gravado', data_gravacao: '2026-07-08', data_publicacao: '2026-07-19', responsavel: 'Claudia' },
  { id: 6, programa: 'Pediatricos', episodio: 'EP049', titulo: 'Vacinação infantil', status: 'publicado', data_gravacao: '2026-07-05', data_publicacao: '2026-07-09', responsavel: 'Ana' },
  { id: 7, programa: 'Minuto Simers', episodio: 'EP048', titulo: 'Direitos do médico', status: 'publicado', data_gravacao: '2026-07-01', data_publicacao: '2026-07-03', responsavel: 'Rafael' },
];

export const CORP_STATUS_LABELS = {
  em_producao: 'Em produção',
  gravado: 'Gravado',
  em_edicao: 'Em edição',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
};

// --- IAcervo Corp — Agenda semanal (Visão geral) ---
export const MOCK_CORP_AGENDA_EVENTS = [
  { id: 'ev1', day: 15, title: 'EP054 — Sala de Prescrição', programa: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', horario: '14:00', estudio: 'Estúdio 1', convidado: 'Dr. Paulo Souza', type: 'gravacao', tone: 'bg-amber-500' },
  { id: 'ev2', day: 15, title: 'EP052 — Opinião Simers', programa: 'Opinião Simers', episodio: 'EP052', titulo: 'Entrevista mensal', horario: '16:00', estudio: 'Estúdio 1', convidado: 'Diretoria Simers', type: 'aprovacao', tone: 'bg-sky-500' },
  { id: 'ev3', day: 17, title: 'EP054 — Sala de Prescrição', programa: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', horario: '10:00', estudio: 'Estúdio 1', convidado: 'Dr. Paulo Souza', type: 'publicacao', tone: 'bg-emerald-500' },
];

// --- IAcervo Corp — Agenda de edição (Editor de vídeo) ---
export const MOCK_CORP_AGENDA_EDICAO = [
  { id: 'ed1', day: 15, title: 'EP054 — Corte fino', programa: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', horario: '09:00', estudio: 'Ilha de Edição 1', convidado: '—', type: 'edicao', tone: 'bg-violet-500' },
  { id: 'ed2', day: 16, title: 'EP052 — Revisão interna', programa: 'Opinião Simers', episodio: 'EP052', titulo: 'Entrevista mensal', horario: '11:00', estudio: 'Ilha de Edição 2', convidado: '—', type: 'edicao', tone: 'bg-sky-500' },
  { id: 'ed3', day: 17, title: 'EP054 — Render final', programa: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', horario: '15:00', estudio: 'Ilha de Edição 1', convidado: '—', type: 'edicao', tone: 'bg-amber-500' },
  { id: 'ed4', day: 18, title: 'EP050 — Corte fino', programa: 'Corações e Mentes', episodio: 'EP050', titulo: 'Saúde mental no trabalho', horario: '10:00', estudio: 'Ilha de Edição 2', convidado: '—', type: 'edicao', tone: 'bg-violet-500' },
];

// --- IAcervo Corp — Linha do tempo (produção detalhe) ---
export const MOCK_CORP_TIMELINE = [
  { time: '14:00', label: 'Gravação concluída', user: 'Larissa' },
  { time: '14:15', label: 'Arquivos importados (6vídeos)', user: 'Sistema' },
  { time: '14:30', label: 'Edição iniciada', user: 'Ana' },
  { time: '16:30', label: 'Primeira versão exportada', user: 'Ana' },
  { time: '16:45', label: 'Aguardando revisão', user: 'Ana' },
  { time: '17:00', label: 'Revisão editada', user: 'Claudia' },
  { time: '17:10', label: 'Aprovação pendente', user: 'Claudia' },
];

// --- IAcervo Corp — Mídias (MAM / Acervo) ---
export const MOCK_CORP_MEDIA = [
  { id: 1, name: 'vmix_20260713_1400.mp4', icon: '🎬', duration: '48:32', size: '4.2 GB', status: 'bruto' },
  { id: 2, name: 'Camera 2 - Convidado.mp4', icon: '🎥', duration: '48:32', size: '4.1 GB', status: 'bruto' },
  { id: 3, name: 'vmix_MASTER_FINAL.mp4', icon: '🏁', duration: '18:12', size: '2.1 GB', status: 'finalizado' },
  { id: 4, name: 'Audio - Mesa.wav', icon: '🎧', duration: '48:32', size: '620 MB', status: 'bruto' },
];

// --- IAcervo Corp — Publicações ---
export const MOCK_CORP_PUBLICATIONS = [
  { id: 1, titulo: 'A trajetória do Preto na medicina', descricao: 'Histórias, desafios e conquistas de médicos negros na área da saúde.', plataforma: 'youtube', status: 'publicado', duracao: '00:58', views: '2.1K' },
  { id: 2, titulo: 'O maior desafio da carreira', descricao: 'Um recorte emocionante sobre os jovens na área da medicina.', plataforma: 'tiktok', status: 'programado', duracao: '00:42', views: '1.8K' },
  { id: 3, titulo: 'Construindo caminhos', descricao: 'Trechos marcantes sobre representatividade.', plataforma: 'linkedin', status: 'rascunho', duracao: '01:10', views: '—' },
];

// --- IAcervo Corp — Recortes ---
export const MOCK_CORP_RECORTES = [
  { id: 1, titulo: 'A trajetória do Preto na medicina', tipo: 'Destaque' },
];

// --- IAcervo Corp — Analytics ---
export const MOCK_CORP_ANALYTICS = {
  visualizacoes: '320.4K',
  watch_time: '18.2K h',
  inscritos: '+1.220',
  comentarios: 4320,
  top_programas: [
    { name: 'Sala de Prescrição', value: 84.3 },
    { name: 'Fronteiras da Saúde', value: 72.1 },
    { name: 'No Front', value: 61.8 },
    { name: 'Opinião Simers', value: 50.2 },
    { name: 'Corações e Mentes', value: 28.6 },
  ],
  serie_visualizacoes: [12, 18, 15, 24, 20, 30, 28],
};

// --- IAcervo Corp — Funções do setor de comunicação ---
export const MOCK_CORP_ROLES = [
  { id: 'produtora', name: 'Produtora', person: 'Claudia', icon: '🎬', greeting: 'Produção de conteúdo audiovisual e podcasts' },
  { id: 'editora', name: 'Editora', person: 'Ana', icon: '✂️', greeting: 'Edição e pós-produção' },
  { id: 'assessoria', name: 'Assessoria de Imprensa', person: 'Rafael', icon: '📰', greeting: 'Relacionamento com a imprensa e releases' },
  { id: 'designer', name: 'Designer', person: 'Bianca', icon: '🎨', greeting: 'Design e identidade visual' },
  { id: 'redacao', name: 'Redação', person: 'Larissa', icon: '✍️', greeting: 'Textos e conteúdo editorial' },
  { id: 'endomarketing', name: 'Endomarketing', person: 'Marina', icon: '👥', greeting: 'Comunicação interna e endomarketing' },
];

// Editora
export const MOCK_CORP_EDITS = [
  { id: 1, titulo: 'EP054 — Sala de Prescrição', programa: 'Sala de Prescrição', progresso: 68, status: 'Em edição', prazo: '17/09' },
  { id: 2, titulo: 'EP052 — Opinião Simers', programa: 'Opinião Simers', progresso: 32, status: 'Em edição', prazo: '18/09' },
  { id: 3, titulo: 'Vinhetas — Out/2026', programa: 'Institucional', progresso: 90, status: 'Revisão', prazo: '16/09' },
  { id: 4, titulo: 'Teaser EP054', programa: 'Sala de Prescrição', progresso: 15, status: 'Na fila', prazo: '19/09' },
  { id: 5, titulo: 'EP050 — Corações e Mentes', programa: 'Corações e Mentes', progresso: 45, status: 'Em edição', prazo: '20/09' },
  { id: 6, titulo: 'Chamada — No Front EP051', programa: 'No Front', progresso: 0, status: 'Na fila', prazo: '22/09' },
];
export const MOCK_CORP_EDIT_APPROVALS = [
  { id: 1, titulo: 'EP053 — Final cut', solicitante: 'Claudia', tempo: 'há 1h' },
  { id: 2, titulo: 'Vinheta abertura v3', solicitante: 'Bianca', tempo: 'há 3h' },
];
export const MOCK_CORP_EDIT_MEDIA = [
  { id: 1, name: 'entrevista_bruta.mov', duration: '42:10', size: '3.1 GB' },
  { id: 2, name: 'camera_02.mov', duration: '42:10', size: '2.9 GB' },
  { id: 3, name: 'audio_mesa.wav', duration: '42:10', size: '620 MB' },
];

// Assessoria de Imprensa
export const MOCK_CORP_RELEASES = [
  { id: 1, titulo: 'Resultado trimestral 3T26', status: 'publicado', veiculos: 14, data: '10/09' },
  { id: 2, titulo: 'Posicionamento sobre projeto X', status: 'rascunho', veiculos: 0, data: '—' },
  { id: 3, titulo: 'Nomeação novo diretor', status: 'agendado', veiculos: 0, data: '15/09' },
  { id: 4, titulo: 'Campanha de vacinação — apoio institucional', status: 'publicado', veiculos: 9, data: '05/09' },
  { id: 5, titulo: 'Balanço social 2026', status: 'rascunho', veiculos: 0, data: '—' },
];
export const MOCK_CORP_CLIPPINGS = [
  { id: 1, veiculo: 'Jornal A', titulo: 'Empresa anuncia crescimento', tom: 'positivo', data: 'há 2h' },
  { id: 2, veiculo: 'Portal B', titulo: 'Especialista comenta projeto', tom: 'neutro', data: 'há 5h' },
  { id: 3, veiculo: 'TV C', titulo: 'Entrevista com diretor', tom: 'positivo', data: 'há 1d' },
  { id: 4, veiculo: 'Rádio D', titulo: 'Comentário sobre nomeação', tom: 'neutro', data: 'há 1d' },
  { id: 5, veiculo: 'Portal E', titulo: 'Crítica ao posicionamento', tom: 'negativo', data: 'há 2d' },
];
export const MOCK_CORP_JOURNALISTS = [
  { id: 1, nome: 'João Lima', veiculo: 'Jornal A', area: 'Economia' },
  { id: 2, nome: 'Maria Souza', veiculo: 'Portal B', area: 'Tecnologia' },
  { id: 3, nome: 'Pedro Alves', veiculo: 'TV C', area: 'Geral' },
  { id: 4, nome: 'Fernanda Ramos', veiculo: 'Rádio D', area: 'Saúde' },
  { id: 5, nome: 'Lucas Teixeira', veiculo: 'Portal E', area: 'Política' },
];

// Designer
export const MOCK_CORP_DESIGNS = [
  { id: 1, titulo: 'Campanha institucional Q3', status: 'em_andamento', prazo: '25/09', tipo: 'Campanha' },
  { id: 2, titulo: 'Capa revista #12', status: 'aprovacao', prazo: '20/09', tipo: 'Editorial' },
  { id: 3, titulo: 'Templates redes sociais', status: 'em_andamento', prazo: '28/09', tipo: 'Social' },
  { id: 4, titulo: 'Thumbnails EP054/EP055', status: 'em_andamento', prazo: '17/09', tipo: 'Audiovisual' },
  { id: 5, titulo: 'Arte Setembro Amarelo', status: 'entregue', prazo: '10/09', tipo: 'Campanha' },
];
export const MOCK_CORP_DESIGN_ASSETS = [
  { id: 1, name: 'logo_simers_v4.svg', tipo: 'Logo' },
  { id: 2, name: 'paleta_institucional.pdf', tipo: 'Guia' },
  { id: 3, name: 'templates_ig.psd', tipo: 'Template' },
  { id: 4, name: 'icons_set.zip', tipo: 'Ícones' },
  { id: 5, name: 'fontes_oficiais.zip', tipo: 'Tipografia' },
  { id: 6, name: 'thumbnails_padrao.psd', tipo: 'Template' },
];

// Redação
export const MOCK_CORP_ARTICLES = [
  { id: 1, titulo: 'Coluna do presidente — setembro', status: 'revisao', prazo: '16/09', canal: 'Portal' },
  { id: 2, titulo: 'Artigo: futuro da saúde', status: 'rascunho', prazo: '22/09', canal: 'Blog' },
  { id: 3, titulo: 'Newsletter semanal #34', status: 'publicado', prazo: '12/09', canal: 'E-mail' },
  { id: 4, titulo: 'Bastidores do Sala de Prescrição', status: 'rascunho', prazo: '24/09', canal: 'Blog' },
  { id: 5, titulo: 'Guia rápido: vacinação infantil', status: 'revisao', prazo: '19/09', canal: 'Portal' },
  { id: 6, titulo: 'Newsletter semanal #35', status: 'rascunho', prazo: '19/09', canal: 'E-mail' },
];
export const MOCK_CORP_PAUTAS = [
  { id: 1, titulo: 'Entrevista diretoria', status: 'aprovada', canal: 'Portal' },
  { id: 2, titulo: 'Caso de sucesso', status: 'em_pauta', canal: 'Social' },
  { id: 3, titulo: 'Panorama trimestral', status: 'aprovada', canal: 'Newsletter' },
  { id: 4, titulo: 'Bastidores da gravação EP054', status: 'em_pauta', canal: 'Blog' },
  { id: 5, titulo: 'Perfil: novos apresentadores', status: 'aprovada', canal: 'Portal' },
];

// Endomarketing
export const MOCK_CORP_CAMPAIGNS = [
  { id: 1, titulo: 'Setembro Amarelo', status: 'ativa', alcance: '82%', engajamento: '64%' },
  { id: 2, titulo: 'Programa de ideias', status: 'planejada', alcance: '—', engajamento: '—' },
  { id: 3, titulo: 'Onboarding novos colaboradores', status: 'ativa', alcance: '100%', engajamento: '78%' },
  { id: 4, titulo: 'Pesquisa de clima organizacional', status: 'planejada', alcance: '—', engajamento: '—' },
  { id: 5, titulo: 'Reconhecimento de equipe Q3', status: 'ativa', alcance: '91%', engajamento: '70%' },
];
export const MOCK_CORP_NEWSLETTERS = [
  { id: 1, titulo: 'Conexão Interna #34', envio: '12/09', abertura: '72%', cliques: '18%' },
  { id: 2, titulo: 'Conexão Interna #33', envio: '05/09', abertura: '68%', cliques: '15%' },
  { id: 3, titulo: 'Conexão Interna #32', envio: '29/08', abertura: '65%', cliques: '13%' },
];

// --- IAcervo Corp — Gravações (agendamento) ---
export const MOCK_CORP_RECORDINGS = [
  { id: 1, programa: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', data: '2026-09-15', horario: '14:00', duracao_prevista: '60 min', estudio: 'Estúdio 1', equipamentos: '2 câmeras, mesa de áudio, teleprompter', equipe: 'Claudia, Rafael, Ana', convidado: 'Dr. Paulo Souza', status: 'confirmada', briefing: { objetivo: 'Discutir representatividade e desafios de médicos negros na medicina.', pauta: 'Trajetória pessoal, barreiras, conquistas e futuro da área.', perguntas: 'Como foi sua formação? Quais os maiores obstáculos? Que conselhos dá a jovens médicos negros?' } },
  { id: 2, programa: 'Fronteiras da Saúde', episodio: 'EP055', titulo: 'Desafios do SUS', data: '2026-09-18', horario: '10:00', duracao_prevista: '45 min', estudio: 'Estúdio 2', equipamentos: '1 câmera, mesa de áudio', equipe: 'Ana, Rafael', convidado: 'Dra. Marina Lopes', status: 'planejada', briefing: { objetivo: 'Analisar os gargalos do SUS sob a ótica médica.', pauta: 'Financiamento, atendimento, filas e propostas de melhoria.', perguntas: 'Onde está o principal gargalo? Como melhorar o atendimento ao paciente?' } },
  { id: 3, programa: 'Opinião Simers', episodio: 'EP052', titulo: 'Entrevista mensal', data: '2026-09-12', horario: '16:00', duracao_prevista: '30 min', estudio: 'Estúdio 1', equipamentos: '1 câmera, mesa de áudio', equipe: 'Rafael', convidado: 'Diretoria Simers', status: 'gravada', briefing: { objetivo: 'Posicionamento mensal do sindicato.', pauta: 'Pautas do mês, posicionamentos e próximos passos.', perguntas: 'Quais as pautas prioritárias? Como os médicos podem participar?' } },
];

export const MOCK_CORP_PRECHECKLIST = [
  'Confirmar disponibilidade do convidado',
  'Validar pauta com o apresentador',
  'Separar materiais de apoio',
  'Agendar gravação e reservar estúdio',
];

// --- IAcervo Corp — Produção unificada (fluxo Kanban) ---
// Um mesmo projeto atravessa as etapas. Arrastar o cartão no Kanban muda a etapa.
export const PRODUCAO_ETAPAS = [
  { id: 'rascunho', name: 'Rascunho' },
  { id: 'gravacao', name: 'Gravação' },
  { id: 'em_edicao', name: 'Em edição' },
  { id: 'em_aprovacao', name: 'Em aprovação' },
  { id: 'finalizado', name: 'Finalizado' },
];

export const MOCK_CORP_PRODUCAO_PROJETOS = [
  { id: 1, programa: 'Corações e Mentes', episodio: 'EP050', titulo: 'Saúde mental no trabalho', etapa: 'rascunho', responsavel: 'Claudia', headline: 'Saúde mental no trabalho', descricao: '', pauta: '', convidado_nome: '', convidado_cg: '', gravacao: null, equipe: [], apresentadores: [] },
  { id: 2, programa: 'No Front', episodio: 'EP051', titulo: 'Inovação em telemedicina', etapa: 'gravacao', responsavel: 'Bianca', headline: 'Telemedicina: o futuro chegou?', descricao: 'Como a tecnologia está transformando o atendimento médico a distância.', pauta: 'Telemedicina, regulação, casos de sucesso e gargalos do atendimento remoto.', convidado_nome: 'Dra. Marina Lopes', convidado_cg: 'Presidente — TeleSaúde', gravacao: { data: '2026-09-18', horario: '10:00', estudio: 'Estúdio 2' }, equipe: ['Bianca', 'Rafael', 'Ana'], apresentadores: [{ nome: 'Dr. Carlos Mendes', cg: 'Cardiologista — CRM 12345' }] },
  { id: 3, programa: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', etapa: 'em_edicao', responsavel: 'Ana', headline: '', descricao: '', pauta: 'Trajetória, barreiras e conquistas de médicos negros na medicina.', convidado_nome: 'Dr. Paulo Souza', convidado_cg: 'Médico — USP', gravacao: { data: '2026-09-15', horario: '14:00', estudio: 'Estúdio 1' }, equipe: ['Claudia', 'Rafael', 'Ana'], apresentadores: [{ nome: 'Dr. Carlos Mendes', cg: 'Cardiologista — CRM 12345' }] },
  { id: 4, programa: 'Opinião Simers', episodio: 'EP052', titulo: 'Entrevista mensal', etapa: 'em_edicao', responsavel: 'Rafael', headline: '', descricao: '', pauta: 'Pautas do mês e posicionamentos do sindicato.', convidado_nome: 'Diretoria Simers', convidado_cg: 'Diretoria', gravacao: { data: '2026-09-12', horario: '16:00', estudio: 'Estúdio 1' }, equipe: ['Rafael'], apresentadores: [{ nome: 'Dra. Ana Ribeiro', cg: 'Diretora Médica — CRM 67890' }] },
  { id: 5, programa: 'Fronteiras da Saúde', episodio: 'EP053', titulo: 'Desafios do SUS', etapa: 'em_aprovacao', responsavel: 'Ana', headline: '', descricao: '', pauta: 'Financiamento, filas e propostas de melhoria do SUS.', convidado_nome: 'Dra. Marina Lopes', convidado_cg: 'Secretária Municipal de Saúde', gravacao: { data: '2026-09-14', horario: '10:00', estudio: 'Estúdio 2' }, equipe: ['Ana', 'Rafael'], apresentadores: [{ nome: 'Dr. Carlos Mendes', cg: 'Cardiologista — CRM 12345' }] },
  { id: 6, programa: 'Pediatricos', episodio: 'EP049', titulo: 'Vacinação infantil', etapa: 'finalizado', responsavel: 'Ana', headline: 'A importância da vacinação', descricao: 'Especial sobre o calendário vacinal infantil.', pauta: 'Calendário vacinal e dúvidas dos pais.', convidado_nome: 'Dr. Paulo Souza', convidado_cg: 'Pediatra — USP', gravacao: { data: '2026-07-05', horario: '14:00', estudio: 'Estúdio 1' }, equipe: ['Ana'], apresentadores: [{ nome: 'Dra. Ana Ribeiro', cg: 'Diretora Médica — CRM 67890' }] },
  { id: 7, programa: 'Minuto Simers', episodio: 'EP048', titulo: 'Direitos do médico', etapa: 'finalizado', responsavel: 'Rafael', headline: '', descricao: '', pauta: 'Direitos trabalhistas do médico.', convidado_nome: '', convidado_cg: '', gravacao: { data: '2026-07-01', horario: '16:00', estudio: 'Estúdio 1' }, equipe: ['Rafael'], apresentadores: [] },
];

// --- IAcervo Corp — Rascunhos de produção (fluxo: rascunho → gravação → pós) ---
export const MOCK_CORP_PRESENTERS = [
  { id: 1, nome: 'Dr. Carlos Mendes', cg: 'Cardiologista — CRM 12345' },
  { id: 2, nome: 'Dra. Ana Ribeiro', cg: 'Diretora Médica — CRM 67890' },
];

export const MOCK_CORP_DRAFTS = [
  { id: 1, titulo: 'Saúde mental no trabalho', programa: 'Corações e Mentes', headline: '', descricao: '', convidado_nome: '', convidado_cg: '', apresentadores: [{ nome: 'Dr. Carlos Mendes', cg: 'Cardiologista — CRM 12345' }], status: 'rascunho', gravacao: null },
  { id: 2, titulo: 'Inovação em telemedicina', programa: 'No Front', headline: 'Telemedicina: o futuro chegou?', descricao: 'Como a tecnologia está transformando o atendimento médico a distância.', convidado_nome: 'Dra. Marina Lopes', convidado_cg: 'Presidente — TeleSaúde', apresentadores: [{ nome: 'Dr. Carlos Mendes', cg: 'Cardiologista — CRM 12345' }, { nome: 'Dra. Ana Ribeiro', cg: 'Diretora Médica — CRM 67890' }], status: 'agendada', gravacao: { data: '2026-09-18', horario: '10:00', estudio: 'Estúdio 2' } },
  { id: 3, titulo: 'Vacinação infantil', programa: 'Pediatricos', headline: 'A importância da vacinação', descricao: 'Especial sobre o calendário vacinal infantil.', convidado_nome: 'Dr. Paulo Souza', convidado_cg: 'Pediatra — USP', apresentadores: [{ nome: 'Dra. Ana Ribeiro', cg: 'Diretora Médica — CRM 67890' }], status: 'gravada', gravacao: { data: '2026-09-10', horario: '14:00', estudio: 'Estúdio 1' } },
];

// --- IAcervo Corp — Pendências (Kanban + Prompt IA) por segmento ---
export const MOCK_CORP_PENDENCIES = {
  producao: [
    { id: 'p1', titulo: 'Confirmar convidado EP054', status: 'pendente', responsavel: 'Claudia', contexto: 'Dr. Paulo Souza — confirmar agenda' },
    { id: 'p2', titulo: 'Reservar estúdio 1 (15/09 14h)', status: 'em_andamento', responsavel: 'Rafael', contexto: 'Aguardando retorno da portaria' },
    { id: 'p3', titulo: 'Finalizar roteiro EP054', status: 'pendente', responsavel: 'Larissa', contexto: 'Pauta aprovada, falta redação' },
    { id: 'p4', titulo: 'Arte da capa EP054', status: 'pendente', responsavel: 'Bianca', contexto: 'Briefing em aberto' },
    { id: 'p5', titulo: 'EP053 — exportar versão final', status: 'concluido', responsavel: 'Ana', contexto: 'Final cut entregue' },
  ],
  redacao: [
    { id: 'r1', titulo: 'Coluna do presidente — setembro', status: 'em_andamento', responsavel: 'Larissa', contexto: 'Revisão editorial' },
    { id: 'r2', titulo: 'Artigo: futuro da saúde', status: 'pendente', responsavel: 'Larissa', contexto: 'Rascunho, falta SEO' },
    { id: 'r3', titulo: 'Newsletter semanal #35', status: 'pendente', responsavel: 'Larissa', contexto: 'Pauta aprovada' },
    { id: 'r4', titulo: 'Newsletter #34 — agendar envio', status: 'concluido', responsavel: 'Larissa', contexto: 'Enviada' },
  ],
  design: [
    { id: 'd1', titulo: 'Campanha institucional Q3 — capa', status: 'em_andamento', responsavel: 'Bianca', contexto: 'v4 em aprovação' },
    { id: 'd2', titulo: 'Capa revista #12', status: 'pendente', responsavel: 'Bianca', contexto: 'Aguarda foto final' },
    { id: 'd3', titulo: 'Templates redes sociais', status: 'pendente', responsavel: 'Bianca', contexto: 'v1 inicial' },
    { id: 'd4', titulo: 'Ícones do set — exportar', status: 'concluido', responsavel: 'Bianca', contexto: 'Entregue ao brand kit' },
  ],
  assessoria: [
    { id: 'a1', titulo: 'Release — resultado trimestral', status: 'em_andamento', responsavel: 'Rafael', contexto: 'Em revisão final' },
    { id: 'a2', titulo: 'Posicionamento sobre projeto X', status: 'pendente', responsavel: 'Rafael', contexto: 'Falta aprovação da diretoria' },
    { id: 'a3', titulo: 'Nomeação novo diretor — agendar', status: 'pendente', responsavel: 'Rafael', contexto: 'Agendar envio 15/09' },
    { id: 'a4', titulo: 'Clipping diário — classificar', status: 'concluido', responsavel: 'Rafael', contexto: '3 menções classificadas' },
  ],
  audiovisual: [
    { id: 'av1', titulo: 'EP054 — edição final', status: 'em_andamento', responsavel: 'Ana', contexto: '68% concluído' },
    { id: 'av2', titulo: 'EP052 — revisão', status: 'pendente', responsavel: 'Ana', contexto: '32% concluído' },
    { id: 'av3', titulo: 'Vinhetas Out/2026', status: 'pendente', responsavel: 'Ana', contexto: 'Revisão' },
    { id: 'av4', titulo: 'Teaser EP054', status: 'pendente', responsavel: 'Ana', contexto: 'Na fila' },
    { id: 'av5', titulo: 'EP053 — final cut', status: 'concluido', responsavel: 'Ana', contexto: 'Aprovado' },
  ],
  revistas: [
    { id: 'rev1', titulo: 'Revista #12 — panorama trimestral', status: 'em_andamento', responsavel: 'Larissa', contexto: 'Revisão' },
    { id: 'rev2', titulo: 'Revista #12 — entrevista diretoria', status: 'pendente', responsavel: 'Larissa', contexto: 'Rascunho' },
    { id: 'rev3', titulo: 'Revista #12 — caso de sucesso', status: 'concluido', responsavel: 'Larissa', contexto: 'Aprovado' },
    { id: 'rev4', titulo: 'Especial Saúde Mental — diagramação', status: 'pendente', responsavel: 'Bianca', contexto: 'Aguarda artes' },
  ],
  endomarketing: [
    { id: 'e1', titulo: 'Setembro Amarelo — campanha ativa', status: 'em_andamento', responsavel: 'Marina', contexto: 'Alcance 82%' },
    { id: 'e2', titulo: 'Programa de ideias — planejar', status: 'pendente', responsavel: 'Marina', contexto: 'Planejada' },
    { id: 'e3', titulo: 'Onboarding novos colaboradores', status: 'pendente', responsavel: 'Marina', contexto: 'Conteúdo em aberto' },
    { id: 'e4', titulo: 'Conexão Interna #34', status: 'concluido', responsavel: 'Marina', contexto: 'Enviada, abertura 72%' },
  ],
};

// --- IAcervo Corp — Podcast (gravação + edição) ---
export const MOCK_CORP_PODCAST_RECORDINGS = [
  { id: 1, podcast: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', data: '2026-09-15', horario: '14:00', duracao: '60 min', estudio: 'Estúdio 1', convidado: 'Dr. Paulo Souza', status: 'confirmada' },
  { id: 2, podcast: 'Fronteiras da Saúde', episodio: 'EP055', titulo: 'Desafios do SUS', data: '2026-09-18', horario: '10:00', duracao: '45 min', estudio: 'Estúdio 2', convidado: 'Dra. Marina Lopes', status: 'planejada' },
  { id: 3, podcast: 'Opinião Simers', episodio: 'EP052', titulo: 'Entrevista mensal', data: '2026-09-12', horario: '16:00', duracao: '30 min', estudio: 'Estúdio 1', convidado: 'Diretoria Simers', status: 'gravada' },
];

export const MOCK_CORP_PODCAST_EDITS = [
  { id: 1, podcast: 'Sala de Prescrição', episodio: 'EP054', titulo: 'A trajetória do Preto na medicina', progresso: 68, status: 'Em edição', prazo: '17/09' },
  { id: 2, podcast: 'Opinião Simers', episodio: 'EP052', titulo: 'Entrevista mensal', progresso: 32, status: 'Em edição', prazo: '18/09' },
  { id: 3, podcast: 'Corações e Mentes', episodio: 'EP050', titulo: 'Saúde mental no trabalho', progresso: 0, status: 'Na fila', prazo: '19/09' },
];

// --- IAcervo Corp — Fila central de aprovações ---
export const MOCK_CORP_APPROVAL_QUEUE = [
  { id: 'ap1', titulo: 'Capa revista #12 — v2', segmento: 'Design', tipo: 'Arte', solicitante: 'Bianca', tempo: 'há 30min', prioridade: 'alta' },
  { id: 'ap2', titulo: 'EP053 — Sala de Prescrição (final cut)', segmento: 'Audiovisual', tipo: 'Edição', solicitante: 'Ana', tempo: 'há 1h', prioridade: 'alta' },
  { id: 'ap3', titulo: 'Vinheta abertura v3', segmento: 'Design', tipo: 'Arte', solicitante: 'Bianca', tempo: 'há 3h', prioridade: 'media' },
  { id: 'ap4', titulo: 'Release — nomeação novo diretor', segmento: 'Assessoria', tipo: 'Release', solicitante: 'Rafael', tempo: 'há 4h', prioridade: 'media' },
  { id: 'ap5', titulo: 'Coluna do presidente — setembro', segmento: 'Redação', tipo: 'Matéria', solicitante: 'Larissa', tempo: 'há 5h', prioridade: 'alta' },
  { id: 'ap6', titulo: 'Revista Simers #12 — panorama trimestral', segmento: 'Revistas', tipo: 'Matéria', solicitante: 'Larissa', tempo: 'há 6h', prioridade: 'media' },
  { id: 'ap7', titulo: 'Campanha Setembro Amarelo — comunicado', segmento: 'Endomarketing', tipo: 'Comunicado', solicitante: 'Marina', tempo: 'há 8h', prioridade: 'baixa' },
  { id: 'ap8', titulo: 'Thumbnails EP054/EP055 — lote', segmento: 'Design', tipo: 'Arte', solicitante: 'Bianca', tempo: 'há 1d', prioridade: 'media' },
  { id: 'ap9', titulo: 'EP050 — Corações e Mentes (revisão)', segmento: 'Audiovisual', tipo: 'Edição', solicitante: 'Ana', tempo: 'há 1d', prioridade: 'media' },
];

// --- IAcervo Corp — Segmentos (subguias) ---
export const MOCK_CORP_SEGMENTS = [
  {
    id: 'redacao',
    name: 'Redação',
    description: 'Textos escritos em geral produzidos pela equipe de comunicação da empresa — matérias, posts, releases internos, roteiro de texto puro (ver EXPANSOES_FUTURAS.md item 11, extensão de versionamento pra roteiro de roteirista).',
    defined: [
      'Mesmo padrão de versionamento + autoria pensado pro Design (item 11) provavelmente vale aqui também — texto passa por várias revisões, precisa de histórico e de quem editou cada versão.',
    ],
    undefined: [
      'Fica junto com Assessoria de Imprensa (que também é texto, mas com destino pra fora da empresa) ou são segmentos realmente separados?',
      'Que tipos de texto entram aqui exatamente — só institucional interno, ou também roteiro de vídeo/áudio do próprio Corp?',
    ],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Artes estáticas — Photoshop (.psd), Illustrator (.ai) e exports finais (PNG/JPG) usados em posts, banners e peças de campanha. É o segmento com mais definição hoje — ver EXPANSOES_FUTURAS.md item 11.',
    defined: [
      'Versionamento é a prioridade — a arte passa por muitas alterações, precisa de histórico de versões de verdade.',
      'Preview visual usa os exports em PNG/JPG (não precisa renderizar .psd/.ai nativo no navegador).',
      'Registrar quem fez cada versão — alimenta relatório de desempenho por pessoa (item 5).',
    ],
    undefined: [
      'Vira um asset_type novo dentro do Acervo atual ou um modelo de dados separado (StaticAsset/DesignFile)?',
      'Fluxo de aprovação (rascunho → revisão → aprovado) — quem aprova, quantas etapas?',
      'Vínculo com campanha/cliente — precisa de um conceito novo ("Campanha") ou reaproveita "Programa"?',
    ],
  },
  {
    id: 'producao',
    name: 'Produção',
    description: 'Alex esclareceu (21/08/2026): aqui é uma FUNÇÃO, igual Design ou Redação — cobre gravação de vídeo, operação de set/estúdio e produção de podcast. Não é o conceito de "Produção" do PDF (que é o núcleo/pipeline por trás de tudo).',
    defined: [
      'É uma função entre outras (como Design, Redação etc.), não um guarda-chuva que engloba os outros segmentos.',
      'Cobre pelo menos 3 tipos de gravação: vídeo, set/estúdio, podcast.',
      'Provavelmente reaproveita o mesmo conceito de carga de trabalho/gargalos já usado em Relatórios > Equipe no MediaMindAI (ver Reports.tsx) — mesma ideia, aplicada a gravações do Corp em vez de matérias de TV.',
    ],
    undefined: [
      'Ainda em aberto (ver PDF do Alex, registrado em 31_PRODUCT_VISION.md): o PDF descreve um "Produção"/"Conteúdo Mestre" que é o NÚCLEO do sistema inteiro — gera pastas/MAM/checklist/publicação automaticamente pra qualquer segmento. A clarificação do Alex resolve o que essa ABA específica cobre (gravação, não o pipeline inteiro), mas não resolve se esse núcleo do PDF vira a arquitetura por baixo de TODOS os segmentos (Design, Redação etc. também), mesmo sem aparecer como aba própria pra eles.',
      'Quais tipos de gravação exatamente — set interno, externa, entrevista remota?',
    ],
  },
  {
    id: 'assessoria',
    name: 'Assessoria de Imprensa',
    description: 'Relacionamento com a imprensa — press releases, clippings, contato com jornalistas e posicionamento institucional voltado pra fora da empresa.',
    defined: [],
    undefined: [
      'Fica junto com Redação (que também produz texto) ou é segmento realmente separado?',
      'Clippings/monitoramento — manual, ferramenta externa ou integração?',
    ],
  },
  {
    id: 'audiovisual',
    name: 'Audiovisual',
    description: 'Edição e pós-produção de conteúdo audiovisual institucional — vídeos, motion graphics e captações internas. Diferente de Produção (gravação), aqui é a pós do material audiovisual do Corp.',
    defined: [],
    undefined: [
      'Onde começa e termina em relação a Produção (gravação) e Editora?',
      'Acervo próprio ou reaproveita o MAM do MediaMindAI?',
    ],
  },
  {
    id: 'revistas',
    name: 'Revistas',
    description: 'Publicações internas ou institucionais em formato de revista/newsletter — edições periódicas com várias matérias/artes reunidas.',
    defined: [],
    undefined: [
      'É uma composição de conteúdo que já existe em Redação/Design (várias matérias + artes organizadas numa edição), ou tem produção própria?',
      'Tem periodicidade fixa (mensal, trimestral) que devia virar um calendário editorial específico?',
      'Formato de saída — PDF pra distribuição, versão web, ou os dois?',
    ],
  },
  {
    id: 'endomarketing',
    name: 'Endomarketing',
    description: 'Comunicação interna voltada pros próprios funcionários da empresa — campanhas de engajamento, comunicados, conteúdo institucional interno.',
    defined: [],
    undefined: [
      'O que diferencia isso de Redação/Assessoria em termos de conteúdo — é o mesmo tipo de texto/arte só com público interno em vez de externo (imprensa) ou público-alvo (redes sociais)?',
      'Precisa de canal de distribuição próprio (intranet, e-mail corporativo, mural digital) ou só produz o conteúdo e a distribuição é externa a essa página?',
    ],
  },
];

// --- IAcervo Corp — Redação (fontes + publicação web) ---
export const MOCK_CORP_SOURCES = [
  { id: 1, nome: 'Dr. Paulo Souza', cargo: 'Médico — USP', contato: 'paulo@usp.br', area: 'Saúde', ultima_pauta: 'EP054' },
  { id: 2, nome: 'Ministério da Saúde', cargo: 'Assessoria de imprensa', contato: 'imprensa@saude.gov.br', area: 'Saúde', ultima_pauta: 'EP055' },
  { id: 3, nome: 'Diretoria Simers', cargo: 'Diretoria', contato: 'diretoria@simers.com.br', area: 'Trabalhista', ultima_pauta: 'EP052' },
];
export const MOCK_CORP_WEB_PUBS = [
  { id: 1, titulo: 'A trajetória do Preto na medicina', slug: 'trajetoria-preto-medicina', categoria: 'Especial', canal: 'Portal', status: 'publicado', data: '17/09' },
  { id: 2, titulo: 'Coluna do presidente — setembro', slug: 'coluna-presidente-set', categoria: 'Institucional', canal: 'Portal', status: 'agendado', data: '22/09' },
  { id: 3, titulo: 'Newsletter semanal #34', slug: 'newsletter-34', categoria: 'Newsletter', canal: 'E-mail', status: 'rascunho', data: '—' },
];

// --- IAcervo Corp — Design (versionamento) ---
export const MOCK_CORP_DESIGN_VERSIONS = [
  { id: 1, titulo: 'Campanha institucional Q3 — capa', versao: 'v4', autor: 'Bianca', data: '12/09 16:20', nota: 'Ajuste de paleta solicitado pela diretoria' },
  { id: 2, titulo: 'Campanha institucional Q3 — capa', versao: 'v3', autor: 'Bianca', data: '10/09 11:05', nota: 'Primeira proposta aprovada parcialmente' },
  { id: 3, titulo: 'Capa revista #12', versao: 'v2', autor: 'Bianca', data: '09/09 14:40', nota: 'Troca da foto principal' },
  { id: 4, titulo: 'Templates redes sociais', versao: 'v1', autor: 'Bianca', data: '05/09 09:10', nota: 'Versão inicial' },
];

// --- IAcervo Corp — Assessoria (monitoramento) ---
export const MOCK_CORP_MENTIONS = [
  { id: 1, veiculo: 'Jornal A', titulo: 'Sindicato comenta novo projeto', tom: 'positivo', data: 'há 1h', etapa: 'monitorada' },
  { id: 2, veiculo: 'Portal B', titulo: 'Especialista questiona medida', tom: 'neutro', data: 'há 4h', etapa: 'classificada' },
  { id: 3, veiculo: 'TV C', titulo: 'Diretoria fala sobre concessões', tom: 'positivo', data: 'há 1d', etapa: 'monitorada' },
  { id: 4, veiculo: 'Rádio D', titulo: 'Repercussão da campanha de vacinação', tom: 'positivo', data: 'há 2d', etapa: 'classificada' },
  { id: 5, veiculo: 'Portal E', titulo: 'Crítica ao posicionamento institucional', tom: 'negativo', data: 'há 3d', etapa: 'monitorada' },
];

// --- IAcervo Corp — Revistas ---
export const MOCK_CORP_MAGAZINES = [
  { id: 1, titulo: 'Revista Simers #12', periodicidade: 'Trimestral', edicao: '12', status: 'em_producao', prazo: '30/09', materias: 8, artes: 12 },
  { id: 2, titulo: 'Revista Simers #11', periodicidade: 'Trimestral', edicao: '11', status: 'publicada', prazo: '30/06', materias: 10, artes: 14 },
  { id: 3, titulo: 'Especial Saúde Mental', periodicidade: 'Especial', edicao: '01', status: 'em_revisao', prazo: '15/10', materias: 6, artes: 8 },
  { id: 4, titulo: 'Revista Simers #10', periodicidade: 'Trimestral', edicao: '10', status: 'publicada', prazo: '31/03', materias: 9, artes: 13 },
];
export const MOCK_CORP_MAGAZINE_ARTICLES = [
  { id: 1, revista: 'Revista Simers #12', titulo: 'Panorama trimestral', autor: 'Larissa', status: 'revisao', paginas: 4 },
  { id: 2, revista: 'Revista Simers #12', titulo: 'Entrevista diretoria', autor: 'Larissa', status: 'rascunho', paginas: 6 },
  { id: 3, revista: 'Revista Simers #12', titulo: 'Caso de sucesso', autor: 'Larissa', status: 'aprovado', paginas: 3 },
  { id: 4, revista: 'Especial Saúde Mental', titulo: 'Saúde mental no trabalho', autor: 'Larissa', status: 'revisao', paginas: 5 },
  { id: 5, revista: 'Especial Saúde Mental', titulo: 'Depoimentos de médicos', autor: 'Larissa', status: 'rascunho', paginas: 4 },
];

// --- IAcervo Corp — Endomarketing (comunicados) ---
export const MOCK_CORP_MEMOS = [
  { id: 1, titulo: 'Reunião geral — setembro', canal: 'Intranet', status: 'publicado', data: '08/09', alcance: '100%' },
  { id: 2, titulo: 'Novo plano de saúde', canal: 'E-mail', status: 'agendado', data: '20/09', alcance: '—' },
  { id: 3, titulo: 'Campanha Setembro Amarelo', canal: 'Mural digital', status: 'rascunho', data: '—', alcance: '—' },
  { id: 4, titulo: 'Pesquisa de clima — lembrete', canal: 'E-mail', status: 'agendado', data: '25/09', alcance: '—' },
  { id: 5, titulo: 'Boas-vindas novos colaboradores', canal: 'Intranet', status: 'publicado', data: '01/09', alcance: '100%' },
];

// --- IAcervo Corp — Cedoc (Administrador de Acervo) ---
export const MOCK_CEDOC_INGEST = [
  { id: 1, titulo: 'Jornal 20h — bruto', origem: 'Studio A', status: 'processando', responsavel: 'Maria Oliveira', arquivos: 14, tamanho_gb: 82, criado: '2026-09-12' },
  { id: 2, titulo: 'Documentário RS — rushes', origem: 'Campo', status: 'pendente', responsavel: 'João Pereira', arquivos: 38, tamanho_gb: 210, criado: '2026-09-11' },
  { id: 3, titulo: 'Entrevista Economia', origem: 'Estúdio B', status: 'concluido', responsavel: 'Maria Oliveira', arquivos: 6, tamanho_gb: 31, criado: '2026-09-10' },
  { id: 4, titulo: 'Campanha Institucional', origem: 'Agência', status: 'pendente', responsavel: 'João Pereira', arquivos: 9, tamanho_gb: 18, criado: '2026-09-09' },
  { id: 5, titulo: 'Festival de Inovação', origem: 'Evento', status: 'falhou', responsavel: 'Carla Dias', arquivos: 22, tamanho_gb: 140, criado: '2026-09-08' },
];

export const MOCK_CEDOC_MIDIAS = [
  { id: 101, titulo: 'Entrevista Prefeito', programa: 'Jornal do Meio Dia', tipo: 'video', status: 'concluido', responsavel: 'Maria Oliveira', tamanho_gb: 1.3, criado: '2026-06-15' },
  { id: 102, titulo: 'Drone Centro Histórico', programa: 'Jornal do Meio Dia', tipo: 'video', status: 'concluido', responsavel: 'João Pereira', tamanho_gb: 1.9, criado: '2026-06-14' },
  { id: 103, titulo: 'Obras de Revitalização', programa: 'Especial Enchentes', tipo: 'video', status: 'processando', responsavel: 'Carla Dias', tamanho_gb: 0.6, criado: '2026-06-11' },
  { id: 104, titulo: 'Relatório Turismo', programa: 'Documentário Turismo', tipo: 'documento', status: 'concluido', responsavel: 'Maria Oliveira', tamanho_gb: 0.02, criado: '2026-06-12' },
  { id: 105, titulo: 'Trilha Institucional', programa: 'Campanha Institucional', tipo: 'audio', status: 'concluido', responsavel: 'João Pereira', tamanho_gb: 0.08, criado: '2026-09-06' },
];

export const MOCK_CEDOC_TAREFAS = [
  { id: 201, titulo: 'Indexar rushes RS', midia: 'Documentário RS', status: 'em_andamento', responsavel: 'João Pereira', prazo: '2026-09-14' },
  { id: 202, titulo: 'Conferir metadados Entrevista', midia: 'Entrevista Prefeito', status: 'aberta', responsavel: 'Maria Oliveira', prazo: '2026-09-13' },
  { id: 203, titulo: 'Re-ingest Festival (falhou)', midia: 'Festival de Inovação', status: 'aberta', responsavel: 'Carla Dias', prazo: '2026-09-13' },
  { id: 204, titulo: 'Backup trilha institucional', midia: 'Trilha Institucional', status: 'concluida', responsavel: 'João Pereira', prazo: '2026-09-10' },
];

export const PERMISSOES_CEDOC = [
  { key: 'ingest', label: 'Ingest' },
  { key: 'editar', label: 'Editar' },
  { key: 'excluir', label: 'Excluir' },
  { key: 'gerenciar', label: 'Gerenciar' },
];

export const MOCK_CEDOC_GRUPOS = [
  { id: 'g_arquivo', nome: 'Arquivo', descricao: 'Custódia e catalogação', permissoes: { ingest: true, editar: true, excluir: false, gerenciar: false } },
  { id: 'g_ingest', nome: 'Ingest', descricao: 'Recebimento de mídia bruta', permissoes: { ingest: true, editar: false, excluir: false, gerenciar: false } },
  { id: 'g_edicao', nome: 'Edição', descricao: 'Pós-produção e metadados', permissoes: { ingest: false, editar: true, excluir: false, gerenciar: false } },
  { id: 'g_supervisao', nome: 'Supervisão', descricao: 'Gestão e arquivamento', permissoes: { ingest: true, editar: true, excluir: true, gerenciar: true } },
];

export const MOCK_CEDOC_USUARIOS = [
  { id: 1, nome: 'Maria Oliveira', email: 'maria@cedoc.tv', papel: 'funcionario', status: 'ativo', tvs: ['TV Capital', 'TV Sul'], midias: 42, grupo: 'g_arquivo', herdaGrupo: true, permissoes: { ingest: true, editar: true, excluir: false, gerenciar: false } },
  { id: 2, nome: 'João Pereira', email: 'joao@cedoc.tv', papel: 'funcionario', status: 'ativo', tvs: ['TV Sul'], midias: 38, grupo: 'g_ingest', herdaGrupo: true, permissoes: { ingest: true, editar: false, excluir: false, gerenciar: false } },
  { id: 3, nome: 'Carla Dias', email: 'carla@cedoc.tv', papel: 'funcionario', status: 'ativo', tvs: ['TV Capital', 'TV Norte'], midias: 27, grupo: 'g_edicao', herdaGrupo: false, permissoes: { ingest: true, editar: true, excluir: false, gerenciar: false } },
  { id: 4, nome: 'Rui Santos', email: 'rui@cedoc.tv', papel: 'funcionario', status: 'suspenso', tvs: ['TV Norte'], midias: 5, grupo: 'g_ingest', herdaGrupo: true, permissoes: { ingest: true, editar: false, excluir: false, gerenciar: false } },
  { id: 5, nome: 'Ana Souza', email: 'ana@cedoc.tv', papel: 'admin', status: 'ativo', tvs: ['TV Capital', 'TV Sul', 'TV Norte'], midias: 0, grupo: 'g_supervisao', herdaGrupo: true, permissoes: { ingest: true, editar: true, excluir: true, gerenciar: true } },
];

export const CEDOC_FUNCIONARIO_EXEMPLO = 'Maria Oliveira';

// --- Storage / acervo stats ---
export const ACERVO_STATS = {
  totalAssets: 18542,
  totalLibraries: 12,
  indexedAssets: 14908,
  failedAssets: 37,
  storageUsagePercent: 72,
};

export const MEDIA_TYPES = [
  { label: 'Vídeos', badge: '7.294', icon: '🎬' },
  { label: 'Áudios', badge: '2.198', icon: '🎵' },
  { label: 'Imagens', badge: '4.812', icon: '🖼️' },
  { label: 'Documentos', badge: '4.387', icon: '📄' },
  { label: 'Roteiros', badge: '891', icon: '📝' },
];

// --- Helpers ---
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTime(seconds) {
  if (seconds == null || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseTime(str) {
  if (!str) return 0;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(str) || 0;
}

export function formatReferenceDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export function formatSize(bytes) {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const tb = bytes / 1e12;
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(0)} MB`;
}
