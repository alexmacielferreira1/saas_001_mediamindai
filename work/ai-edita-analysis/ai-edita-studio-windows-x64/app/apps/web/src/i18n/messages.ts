import { OPERATIONS_MESSAGES } from "./operations-messages";
export type AppLocale = "en" | "pt-BR";

export const DEFAULT_LOCALE: AppLocale = "pt-BR";
export const LOCALE_STORAGE_KEY = "opencut-locale";

export const PT_BR_MESSAGES: Record<string, string> = {
	...OPERATIONS_MESSAGES,
	"Text Outline Width": "Espessura do contorno",
	"Text Outline Color": "Cor do contorno",
	"Text Shadow Opacity": "Opacidade da sombra",
	"Text Shadow Color": "Cor da sombra",
	"Text Shadow Blur": "Desfoque da sombra",
	"Text Shadow X": "Sombra horizontal",
	"Text Shadow Y": "Sombra vertical",
	"Text Reveal": "Revelação do texto",
  Templates: "Templates",
	"AI Studio": "Estúdio IA",
	"Toggle theme": "Alternar tema",
	"Allow AI Edita to protect them?": "Permitir que o AI Edita proteja seus projetos?",
	"For the best experience, open AI Edita in Chrome.": "Para uma melhor experiência, abra o AI Edita no Chrome.",
	"AI Edita works best on a desktop browser with a keyboard and mouse.": "O AI Edita funciona melhor no navegador de um computador, com teclado e mouse.",
	Integrations: "Integrações",
	// Language selector
	Language: "Idioma",
	"Choose language": "Escolher idioma",
	English: "Inglês",
	Portuguese: "Português",
	"Português (Brasil)": "Português (Brasil)",

	// Global navigation and actions
	Home: "Início",
	Projects: "Projetos",
	"All projects": "Todos os projetos",
	Roadmap: "Roteiro",
	Contributors: "Colaboradores",
	Sponsors: "Patrocinadores",
	Blog: "Blog",
	Brand: "Marca",
	"Brand assets": "Recursos da marca",
	Resources: "Recursos",
	Company: "Empresa",
	About: "Sobre",
	"All Rights Reserved": "Todos os direitos reservados",
	previous: "anterior",
	next: "próximo",
	Privacy: "Privacidade",
	"Privacy policy": "Política de privacidade",
	"Terms of use": "Termos de uso",
	"Terms of service": "Termos de serviço",
	Changelog: "Histórico de alterações",
	Close: "Fechar",
	"Close menu": "Fechar menu",
	Dismiss: "Dispensar",
	More: "Mais",
	Loading: "Carregando",
	Dark: "Escuro",
	Light: "Claro",
	Copy: "Copiar",
	"Copy SVG": "Copiar SVG",
	"Download SVG": "Baixar SVG",
	"Download all": "Baixar tudo",
	Cancel: "Cancelar",
	Done: "Concluído",
	Next: "Avançar",
	Finish: "Concluir",
	Retry: "Tentar novamente",
	Save: "Salvar",
	Send: "Enviar",
	Saved: "Salvos",
	Clear: "Limpar",
	"Clear all": "Limpar tudo",
	Delete: "Excluir",
	Duplicate: "Duplicar",
	Rename: "Renomear",
	Warning: "Atenção",
	Allow: "Permitir",
	"Search...": "Pesquisar...",
	Search: "Pesquisar",
	"Searching...": "Pesquisando...",
	"No results found": "Nenhum resultado encontrado",
	"No posts yet": "Ainda não há publicações",
	Older: "Anterior",
	Newer: "Mais recente",
	"See all": "Ver tudo",
	All: "Todos",
	Flags: "Bandeiras",
	"See full changelog": "Ver histórico completo",
	"All releases": "Todas as versões",
	"Copy as markdown": "Copiar como Markdown",

	// Landing page
	"The open source": "O editor de código aberto",
	"Video editor": "Editor de vídeo",
	"A simple but powerful video editor that gets the job done. Works on any platform.":
		"Um editor de vídeo simples e poderoso, disponível em qualquer plataforma.",
	"A simple but powerful video editor that gets the job done. In your browser.":
		"Um editor de vídeo simples e poderoso que funciona no seu navegador.",
	"Try early beta": "Experimentar a versão beta",
	"The privacy-first video editor that feels simple to use.":
		"O editor de vídeo focado em privacidade e fácil de usar.",
	"OpenCut video editor landing page background":
		"Plano de fundo da página inicial do editor de vídeo OpenCut",

	// Projects
	"Grid view": "Visualização em grade",
	"List view": "Visualização em lista",
	"New project": "Novo projeto",
	New: "Novo",
	"Select all": "Selecionar tudo",
	Created: "Criado",
	Modified: "Modificado",
	Name: "Nome",
	Duration: "Duração",
	"Sort by": "Ordenar por",
	"Sort ascending": "Ordenar em ordem crescente",
	"Sort descending": "Ordenar em ordem decrescente",
	"Project menu": "Menu do projeto",
	Info: "Informações",
	project: "projeto",
	projects: "projetos",
	"Project thumbnail": "Miniatura do projeto",
	"No projects yet": "Ainda não há projetos",
	"Start creating your first project. Import media, edit, and export your videos. All privately.":
		"Crie seu primeiro projeto. Importe mídias, edite e exporte seus vídeos com total privacidade.",
	"Create your first project": "Criar seu primeiro projeto",
	"Clear search": "Limpar pesquisa",
	"Failed to create project": "Não foi possível criar o projeto",
	"Failed to save new project": "Não foi possível salvar o novo projeto",
	"Failed to duplicate projects": "Não foi possível duplicar os projetos",
	"Project not found": "Projeto não encontrado",
	"Failed to rename project": "Não foi possível renomear o projeto",
	"Failed to delete project": "Não foi possível excluir o projeto",
	"Please try again": "Tente novamente",
	"Rename project": "Renomear projeto",
	"New name": "Novo nome",
	"Enter a new name": "Digite um novo nome",
	"Delete project": "Excluir projeto",
	'Type "DELETE" to confirm': 'Digite "DELETE" para confirmar',
	"This will permanently delete": "Isso excluirá permanentemente",
	"and all associated files.": "e todos os arquivos associados.",
	"Project information": "Informações do projeto",
	"Project info": "Informações do projeto",
	"Project ID": "ID do projeto",
	"File size": "Tamanho do arquivo",

	// Editor shell
	"Exit project": "Sair do projeto",
	Shortcuts: "Atalhos",
	"Keyboard shortcuts": "Atalhos de teclado",
	"Send feedback": "Enviar feedback",
	Export: "Exportar",
	"Loading project...": "Carregando projeto...",
	"Exiting project...": "Saindo do projeto...",
	"For the best experience, open OpenCut in Chrome.":
		"Para uma melhor experiência, abra o OpenCut no Chrome.",
	"Desktop only (for now)": "Disponível apenas em computador (por enquanto)",
	"Go back": "Voltar",
	"Take a look anyway": "Continuar mesmo assim",
	"Untitled Project": "Projeto sem título",
	"Main scene": "Cena principal",
	"Main Track": "Faixa principal",
	"New scene": "Nova cena",
	"Delete Scenes": "Excluir cenas",
	"Are you sure you want to delete": "Tem certeza de que deseja excluir",
	scene: "cena",
	scenes: "cenas",
	"This action cannot be undone.": "Esta ação não pode ser desfeita.",

	// Editor asset panel
	Media: "Mídia",
	Sounds: "Sons",
	"Loading sounds...": "Carregando sons...",
	Text: "Texto",
	Stickers: "Figurinhas",
	Effects: "Efeitos",
	Transitions: "Transições",
	Captions: "Legendas",
	Adjustment: "Ajustes",
	Settings: "Configurações",
	Assets: "Arquivos",
	Import: "Importar",
	"Drag and drop videos, photos, and audio files here":
		"Arraste e solte vídeos, fotos e arquivos de áudio aqui",
	"No active project": "Nenhum projeto ativo",
	"Export clips": "Exportar clipes",
	Video: "Vídeo",
	Audio: "Áudio",
	Image: "Imagem",
	Unknown: "Desconhecido",
	Type: "Tipo",
	"Adjustment view coming soon...":
		"O painel de ajustes estará disponível em breve...",
	"Transitions view coming soon...":
		"O painel de transições estará disponível em breve...",
	"Default text": "Texto padrão",
	"Add text": "Adicionar texto",

	// Project settings
	Background: "Plano de fundo",
	"Frame rate": "Taxa de quadros",
	"Select a frame rate": "Selecione uma taxa de quadros",
	"Aspect ratio": "Proporção",
	Custom: "Personalizado",
	"Canvas width": "Largura da tela",
	"Canvas height": "Altura da tela",
	"Pick a custom background color": "Escolher uma cor de fundo personalizada",
	Colors: "Cores",
	Blur: "Desfoque",

	// Properties and effects
	"It's empty here": "Não há nada aqui",
	"Click an element on the timeline to edit its properties":
		"Clique em um elemento da linha do tempo para editar suas propriedades",
	Transform: "Transformação",
	Position: "Posição",
	"Position X": "Posição X",
	"Position Y": "Posição Y",
	Size: "Tamanho",
	Width: "Largura",
	Height: "Altura",
	Scale: "Escala",
	"Scale X": "Escala X",
	"Scale Y": "Escala Y",
	Rotation: "Rotação",
	Rotate: "Girar",
	Opacity: "Opacidade",
	Volume: "Volume",
	Speed: "Velocidade",
	"Change pitch": "Alterar tonalidade",
	Graphic: "Gráfico",
	Blending: "Mesclagem",
	"Blend Mode": "Modo de mesclagem",
	Normal: "Normal",
	Multiply: "Multiplicar",
	Screen: "Tela",
	Overlay: "Sobrepor",
	Darken: "Escurecer",
	Lighten: "Clarear",
	"Color Dodge": "Subexposição de cor",
	"Color Burn": "Superexposição de cor",
	"Hard Light": "Luz intensa",
	"Soft Light": "Luz suave",
	Difference: "Diferença",
	Exclusion: "Exclusão",
	Effect: "Efeito",
	"No effects": "Nenhum efeito",
	"Add effects to this layer from the Assets panel.":
		"Adicione efeitos a esta camada pelo painel de arquivos.",
	Fill: "Preenchimento",
	Stroke: "Contorno",
	"Stroke color": "Cor do contorno",
	"Stroke width": "Espessura do contorno",
	"Stroke align": "Alinhamento do contorno",
	"Corner radius": "Raio dos cantos",
	Sides: "Lados",
	Depth: "Profundidade",
	Rectangle: "Retângulo",
	Ellipse: "Elipse",
	Polygon: "Polígono",
	Star: "Estrela",
	Shapes: "Formas",

	// Text properties
	Content: "Conteúdo",
	Font: "Fonte",
	"Font Family": "Família da fonte",
	"Font Size": "Tamanho da fonte",
	"Font Style": "Estilo da fonte",
	"Font Weight": "Peso da fonte",
	"Text Align": "Alinhamento do texto",
	"Text Decoration": "Decoração do texto",
	Bold: "Negrito",
	Underline: "Sublinhado",
	Left: "Esquerda",
	Center: "Centro",
	Right: "Direita",
	Spacing: "Espaçamento",
	"All fonts": "Todas as fontes",
	Favorites: "Favoritas",
	"Failed to load font previews.":
		"Não foi possível carregar as prévias das fontes.",

	// Masks
	Masks: "Máscaras",
	Mask: "Máscara",
	"Add mask": "Adicionar máscara",
	"No masks": "Nenhuma máscara",
	"Add a mask to hide or reveal parts of this layer.":
		"Adicione uma máscara para ocultar ou revelar partes desta camada.",
	Feather: "Suavização",
	Circle: "Círculo",
	Square: "Quadrado",
	Triangle: "Triângulo",
	Diamond: "Losango",
	Split: "Dividir",
	"Cinematic Bars": "Barras cinematográficas",

	// Preview and guides
	Fit: "Ajustar",
	"Fit to screen": "Ajustar à tela",
	"Full screen": "Tela cheia",
	"Preview canvas": "Tela de pré-visualização",
	"Edit text": "Editar texto",
	Guides: "Guias",
	"Add guide line": "Adicionar linha-guia",
	"TikTok Layout": "Layout do TikTok",
	"Social media": "Redes sociais",
	"Copy snapshot": "Copiar captura",
	"Save snapshot": "Salvar captura",
	"Failed to copy snapshot": "Não foi possível copiar a captura",
	"Failed to save snapshot": "Não foi possível salvar a captura",

	// Timeline
	Timeline: "Linha do tempo",
	"Timeline ruler": "Régua da linha do tempo",
	"Timeline playhead": "Cursor da linha do tempo",
	"Drag playhead": "Arrastar cursor",
	"Drag to adjust value": "Arraste para ajustar o valor",
	"Drag to adjust clip volume": "Arraste para ajustar o volume do clipe",
	"Select keyframe": "Selecionar quadro-chave",
	"Delete track": "Excluir faixa",
	"Replace media": "Substituir mídia",
	"Reveal media": "Localizar mídia",
	Note: "Nota",
	"Add a note...": "Adicionar uma nota...",
	Color: "Cor",
	"Reset to default color": "Restaurar cor padrão",
	"delete bookmark": "excluir marcador",
	"Show bookmark notes": "Mostrar notas dos marcadores",
	Presets: "Predefinições",
	Curve: "Curva",
	Smooth: "Suave",
	"Ease in": "Aceleração inicial",
	"Ease out": "Desaceleração final",
	"Bezier curve editor": "Editor de curva Bézier",
	"Curve preset preview": "Prévia da curva predefinida",
	"Select a keyframe to edit its curve.":
		"Selecione um quadro-chave para editar sua curva.",
	"Select a keyframe that has an outgoing segment.":
		"Selecione um quadro-chave que tenha um segmento de saída.",
	"Select at most two adjacent keyframes per property.":
		"Selecione no máximo dois quadros-chave adjacentes por propriedade.",
	"Selected keyframes must be adjacent on each property.":
		"Os quadros-chave selecionados devem ser adjacentes em cada propriedade.",
	"Selected keyframes must be on the same element.":
		"Os quadros-chave selecionados devem estar no mesmo elemento.",
	"Cannot edit a segment where both keyframes are at the same time.":
		"Não é possível editar um segmento cujos quadros-chave estão no mesmo instante.",

	// Keyboard actions
	"Play/Pause": "Reproduzir/Pausar",
	"Stop playback": "Parar reprodução",
	"Seek forward 1 second": "Avançar 1 segundo",
	"Seek backward 1 second": "Voltar 1 segundo",
	"Frame step forward": "Avançar um quadro",
	"Frame step backward": "Voltar um quadro",
	"Jump forward 5 seconds": "Avançar 5 segundos",
	"Jump backward 5 seconds": "Voltar 5 segundos",
	"Go to timeline start": "Ir para o início da linha do tempo",
	"Go to timeline end": "Ir para o fim da linha do tempo",
	"Split elements at playhead": "Dividir elementos no cursor",
	"Split and remove left": "Dividir e remover à esquerda",
	"Split and remove right": "Dividir e remover à direita",
	"Delete current selection": "Excluir seleção atual",
	"Copy selected elements": "Copiar elementos selecionados",
	"Paste elements at playhead": "Colar elementos no cursor",
	"Toggle snapping": "Ativar/desativar encaixe",
	"Toggle ripple editing": "Ativar/desativar edição ripple",
	"Extract or recover source audio": "Extrair ou recuperar áudio original",
	"Select all elements": "Selecionar todos os elementos",
	"Cancel current interaction": "Cancelar interação atual",
	"Deselect all elements": "Desmarcar todos os elementos",
	"Duplicate selected element": "Duplicar elemento selecionado",
	"Mute/unmute selected elements": "Silenciar/reativar elementos selecionados",
	"Show/hide selected elements": "Mostrar/ocultar elementos selecionados",
	"Toggle bookmark at playhead": "Alternar marcador no cursor",
	Undo: "Desfazer",
	Redo: "Refazer",
	"Remove media asset": "Remover arquivo de mídia",
	"Remove media assets": "Remover arquivos de mídia",
	"Reset to default": "Restaurar padrão",
	"Press any key combination...": "Pressione qualquer combinação de teclas...",
	"Click to edit shortcut": "Clique para editar o atalho",
	or: "ou",
	playback: "reprodução",
	navigation: "navegação",
	editing: "edição",
	selection: "seleção",
	history: "histórico",
	timeline: "linha do tempo",
	controls: "controles",
	assets: "arquivos",

	// Export
	Format: "Formato",
	"Export project": "Exportar projeto",
	"Exporting project": "Exportando projeto",
	"Preparing and encoding audio…": "Preparando e codificando o áudio…",
	"Rendering video frames…": "Renderizando os quadros do vídeo…",
	"Finalizing file…": "Finalizando o arquivo…",
	"The preview stays still during export. Keep this tab open.": "Pode fechar esta janela e continuar usando o AI Edita: a exportação segue em segundo plano e avisamos quando terminar. Não feche a aba do navegador.",
	"MP4 (H.264) - Better compatibility": "MP4 (H.264) — melhor compatibilidade",
	"Include audio in export": "Incluir áudio na exportação",
	Quality: "Qualidade",
	"Low - Smallest file size": "Baixa — menor tamanho de arquivo",
	"Medium - Balanced": "Média — equilibrada",
	"High - Recommended": "Alta — recomendada",
	"Very high - Largest file size": "Muito alta — maior tamanho de arquivo",
	"WebM (VP9) - Smaller file size": "WebM (VP9) — arquivo menor",
	"Export failed": "Falha na exportação",
	"Exporting...": "Exportando...",
	"Copy link": "Copiar link",

	// Sounds
	"Sound effects": "Efeitos sonoros",
	"Search sound effects": "Pesquisar efeitos sonoros",
	"No saved sounds": "Nenhum som salvo",
	"Click the heart icon on any sound to save it here":
		"Clique no ícone de coração de um som para salvá-lo aqui",
	"Clear all saved sounds?": "Limpar todos os sons salvos?",
	"Clear all sounds": "Limpar todos os sons",
	"This will permanently remove all": "Isso removerá permanentemente todos os",
	"saved sounds from your collection. This action cannot be undone.":
		"sons salvos da sua coleção. Esta ação não pode ser desfeita.",
	"Add to timeline": "Adicionar à linha do tempo",
	"Show only commercially licensed":
		"Mostrar apenas os licenciados para uso comercial",
	"Only showing sounds licensed for commercial use":
		"Mostrando apenas sons licenciados para uso comercial",
	"Showing all sounds regardless of license":
		"Mostrando todos os sons, independentemente da licença",
	"Failed to save sound": "Não foi possível salvar o som",
	"Failed to remove sound": "Não foi possível remover o som",
	"Failed to clear saved sounds": "Não foi possível limpar os sons salvos",
	"Sound file not available": "Arquivo de som indisponível",
	"Error:": "Erro:",

	// Stickers and captions
	"Sticker categories": "Categorias de figurinhas",
	"No stickers found": "Nenhuma figurinha encontrada",
	"No stickers available yet.": "Ainda não há figurinhas disponíveis.",
	"Failed to add sticker to timeline":
		"Não foi possível adicionar a figurinha à linha do tempo",
	"Recently used": "Usadas recentemente",
	"Select a language": "Selecione um idioma",
	"Auto detect": "Detectar automaticamente",
	"Transcribing audio...": "Transcrevendo áudio...",
	"No audio detected. Add a clip with audio to the timeline first.":
		"Nenhum áudio detectado. Primeiro, adicione à linha do tempo um clipe que contenha áudio.",
	"Generate transcript": "Gerar transcrição",
	Tiny: "Minúsculo",
	Small: "Pequeno",
	"Fastest, lower accuracy": "Mais rápido, menor precisão",
	"Good balance of speed and accuracy":
		"Bom equilíbrio entre velocidade e precisão",
	"Best accuracy, requires WebGPU for good performance":
		"Melhor precisão; requer WebGPU para um bom desempenho",
	Spanish: "Espanhol",
	Italian: "Italiano",
	French: "Francês",
	German: "Alemão",
	Russian: "Russo",
	Japanese: "Japonês",
	Chinese: "Chinês",

	// Feedback and onboarding
	"Thoughts, bugs, ideas...": "Comentários, problemas, ideias...",
	"Feedback sent": "Feedback enviado",
	"← Back": "← Voltar",
	"Welcome to OpenCut Beta! 🎉": "Boas-vindas ao OpenCut Beta! 🎉",
	"You're among the first to try OpenCut - the fully open source CapCut alternative.":
		"Você está entre as primeiras pessoas a experimentar o OpenCut — a alternativa totalmente aberta ao CapCut.",
	"There's still a ton of things to do to make this editor amazing.":
		"Ainda há muito a fazer para tornar este editor incrível.",
	"A lot of features are still missing. We're working hard to build them out!":
		"Muitos recursos ainda não estão disponíveis. Estamos trabalhando para implementá-los!",
	"If you're curious, check out our roadmap [here](https://opencut.app/roadmap)":
		"Se quiser saber mais, consulte nosso roteiro [aqui](https://opencut.app/roadmap)",

	// Browser storage
	"Don't lose your projects": "Não perca seus projetos",
	"Your browser can automatically delete your projects when storage runs low.":
		"Seu navegador pode excluir automaticamente os projetos quando houver pouco espaço.",
	"Allow OpenCut to protect them?": "Permitir que o OpenCut os proteja?",
	"Storage not fully supported. Some features may not work.":
		"O armazenamento não é totalmente compatível. Alguns recursos podem não funcionar.",
	"Not enough browser storage": "Não há espaço suficiente no navegador",
	"Collapse section": "Recolher seção",
	"Expand section": "Expandir seção",

	// Institutional pages
	"What's new in OpenCut": "Novidades do OpenCut",
	"See what's new in OpenCut": "Veja as novidades do OpenCut",
	"Every update, improvement, and fix to OpenCut — documented.":
		"Todas as atualizações, melhorias e correções do OpenCut — documentadas.",
	"Top contributors": "Principais colaboradores",
	"All contributors": "Todos os colaboradores",
	"External tools": "Ferramentas externas",
	"Tools we use to build OpenCut":
		"Ferramentas que usamos para desenvolver o OpenCut",
	contributors: "colaboradores",
	contributions: "contribuições",
	"Join the community": "Participe da comunidade",
	"Want to help?": "Quer ajudar?",
	"Start contributing": "Começar a colaborar",
	"Report issues": "Relatar problemas",
	Usage: "Uso",
	"What's not allowed": "O que não é permitido",
	Symbol: "Símbolo",
	"Read the brand guidelines.": "Leia as diretrizes da marca.",
	"Download OpenCut brand assets for use in your projects.":
		"Baixe os recursos da marca OpenCut para usar em seus projetos.",
	"Support OpenCut and help us build the future of free and open-source video editing.":
		"Apoie o OpenCut e ajude a construir o futuro da edição de vídeo gratuita e de código aberto.",
	"Support OpenCut and help us build the future of privacy-first video editing.":
		"Apoie o OpenCut e ajude a construir o futuro da edição de vídeo focada em privacidade.",
	"Quick summary": "Resumo rápido",
	"Contact Us": "Fale conosco",
	"Your Content, Your Rights": "Seu conteúdo, seus direitos",
	"How You Can Use OpenCut": "Como você pode usar o OpenCut",
	"AI Features": "Recursos de IA",
	Service: "Serviço",
	"Open Source Benefits": "Benefícios do código aberto",
	"Limitations and Liability": "Limitações e responsabilidade",
	"Service Changes": "Alterações no serviço",
	"Stopping Use": "Interrompendo o uso",
	"How We Handle Your Content": "Como tratamos seu conteúdo",
	"Accounts & Authentication": "Contas e autenticação",
	Analytics: "Análises",
	"Local Storage & Cookies": "Armazenamento local e cookies",
	"Third-Party Services": "Serviços de terceiros",
	"Your Rights": "Seus direitos",
	"Open Source Transparency": "Transparência do código aberto",
	"Questions about these terms or need to report an issue?":
		"Tem dúvidas sobre estes termos ou precisa relatar um problema?",
	"Questions about this privacy policy or how we handle your data?":
		"Tem dúvidas sobre esta política de privacidade ou sobre como tratamos seus dados?",

	// Privacy policy
	"Learn how we handle your data and privacy. Contact us if you have any questions.":
		"Saiba como tratamos seus dados e sua privacidade. Entre em contato se tiver alguma dúvida.",
	"Your content never leaves your device.":
		"Seu conteúdo nunca sai do seu dispositivo.",
	"Basic editing happens locally in your browser - we never see your files":
		"A edição básica acontece localmente no navegador — nunca vemos seus arquivos",
	"AI features like auto captions run locally in your browser too - nothing is uploaded":
		"Recursos de IA, como legendas automáticas, também funcionam localmente no navegador — nada é enviado",
	"OpenCut does not currently require an account or login":
		"Atualmente, o OpenCut não exige conta nem login",
	"Project data stays on your device, not our servers":
		"Os dados dos projetos ficam no seu dispositivo, não em nossos servidores",
	"We use anonymized analytics to improve the app, but no personal video content is tracked":
		"Usamos análises anônimas para melhorar o aplicativo, mas nenhum conteúdo pessoal de vídeo é rastreado",
	"You can clear local data from your browser at any time":
		"Você pode limpar os dados locais do navegador a qualquer momento",
	"We don't sell or share your data with anyone (we don't even have it)":
		"Não vendemos nem compartilhamos seus dados com ninguém — nós nem sequer os possuímos",
	"Questions? Email us at": "Dúvidas? Envie um e-mail para",
	"All editing and processing happens locally on your device.":
		"Toda a edição e o processamento acontecem localmente no seu dispositivo.",
	"We never upload, store, or have access to your video or audio files. Your content remains completely private and under your control. AI-powered features like auto captions also run in your browser using on-device models - no content ever leaves your device.":
		"Nunca enviamos, armazenamos ou acessamos seus arquivos de vídeo ou áudio. Seu conteúdo permanece totalmente privado e sob seu controle. Recursos de IA, como legendas automáticas, também funcionam no navegador com modelos executados no dispositivo — nenhum conteúdo sai dele.",
	"OpenCut does not currently offer user accounts, login, or Google sign-in.":
		"Atualmente, o OpenCut não oferece contas de usuário, login ou acesso com o Google.",
	"Because there is no account system today, we do not collect account emails, profile information, or OAuth identity data.":
		"Como ainda não há um sistema de contas, não coletamos e-mails, informações de perfil nem dados de identidade OAuth.",
	"Your projects are never stored on our servers. All project data, including names, thumbnails, and creation dates, is stored locally in your browser using IndexedDB.":
		"Seus projetos nunca são armazenados em nossos servidores. Todos os dados, incluindo nomes, miniaturas e datas de criação, ficam localmente no navegador por meio do IndexedDB.",
	"We use": "Usamos",
	"for basic, anonymized visitor counts. We do not track clicks, interactions, or how you use the editor.":
		"para contabilizar visitantes de forma básica e anônima. Não rastreamos cliques, interações nem como você usa o editor.",
	"No personal information is collected, no individual users are tracked, and no data that could identify you is stored.":
		"Nenhuma informação pessoal é coletada, nenhum usuário é rastreado individualmente e nenhum dado que possa identificar você é armazenado.",
	"We use browser local storage and IndexedDB to:":
		"Usamos o armazenamento local do navegador e o IndexedDB para:",
	"Save your projects locally on your device":
		"Salvar os projetos localmente no dispositivo",
	"Remember your editor preferences and settings":
		"Lembrar suas preferências e configurações do editor",
	"Store app state needed for the editor to work between sessions":
		"Armazenar o estado necessário para o editor funcionar entre sessões",
	"All data stays on your device and can be cleared at any time through your browser settings.":
		"Todos os dados ficam no seu dispositivo e podem ser apagados a qualquer momento nas configurações do navegador.",
	"OpenCut integrates with these services:":
		"O OpenCut integra-se aos seguintes serviços:",
	"Vercel:": "Vercel:",
	"Databuddy:": "Databuddy:",
	"For hosting and content delivery": "Para hospedagem e entrega de conteúdo",
	"For anonymized analytics": "Para análises anônimas",
	"You have complete control over your data:":
		"Você tem controle total sobre seus dados:",
	"No account is required to use OpenCut today":
		"Hoje, nenhuma conta é necessária para usar o OpenCut",
	"Clear local storage to remove all saved projects":
		"Limpe o armazenamento local para remover todos os projetos salvos",
	"Contact us with any privacy concerns":
		"Entre em contato se tiver alguma preocupação com privacidade",
	"OpenCut is completely open source. You can review our code, see exactly how we handle data, and even self-host the application if you prefer.":
		"O OpenCut é totalmente aberto. Você pode revisar o código, conferir exatamente como tratamos os dados e até hospedar o aplicativo por conta própria.",
	"View our source code on": "Consulte nosso código-fonte no",
	"Open an issue on our": "Abra uma ocorrência em nosso",
	"GitHub repository": "repositório no GitHub",
	", email us at": ", envie um e-mail para",
	", or reach out on": ", ou fale conosco pelo",
	"Last updated: March 15, 2026": "Última atualização: 15 de março de 2026",

	// Terms of service
	"Fair and transparent terms for our free, open-source video editor. Contact us if you have any questions.":
		"Termos justos e transparentes para nosso editor de vídeo gratuito e de código aberto. Entre em contato se tiver alguma dúvida.",
	"You own your content, we own nothing.":
		"O conteúdo é seu; nós não somos donos de nada.",
	"Everything runs locally in your browser - nothing is ever uploaded to our servers":
		"Tudo funciona localmente no navegador — nada é enviado aos nossos servidores",
	"We never claim ownership of your content":
		"Nunca reivindicamos a propriedade do seu conteúdo",
	"Free for personal and commercial use with no watermarks or restrictions":
		"Uso pessoal e comercial gratuito, sem marcas-d'água ou restrições",
	"You're responsible for how you use it - don't break the law":
		"Você é responsável pela forma como usa o aplicativo — respeite a lei",
	'Service provided "as is" - we can\'t guarantee perfect uptime':
		"Serviço fornecido “no estado em que se encontra” — não podemos garantir disponibilidade perfeita",
	"Open source means you can review our code and self-host if needed":
		"O código aberto permite revisar o código e hospedar o sistema por conta própria",
	"No account required - your exported videos are always yours":
		"Nenhuma conta é necessária — os vídeos exportados sempre pertencem a você",
	"You own everything you create.": "Tudo o que você cria pertence a você.",
	"All editing and processing happens locally on your device. We never see, store, or have access to your files. We make no claims to ownership, licensing, or rights over your videos, projects, or any content you create using OpenCut.":
		"Toda a edição e o processamento acontecem localmente no seu dispositivo. Nunca vemos, armazenamos ou acessamos seus arquivos. Não reivindicamos propriedade, licenciamento ou direitos sobre seus vídeos, projetos ou qualquer conteúdo criado com o OpenCut.",
	"Your content never leaves your device":
		"Seu conteúdo nunca sai do dispositivo",
	"You retain all intellectual property rights to your content":
		"Você mantém todos os direitos de propriedade intelectual sobre seu conteúdo",
	"You can export and use your content however you choose":
		"Você pode exportar e usar seu conteúdo como quiser",
	"No watermarks, no licensing restrictions from OpenCut":
		"Sem marcas-d'água e sem restrições de licenciamento impostas pelo OpenCut",
	"OpenCut is free for personal and commercial use. You can:":
		"O OpenCut é gratuito para uso pessoal e comercial. Você pode:",
	"Create videos for personal, educational, or commercial purposes":
		"Criar vídeos para fins pessoais, educacionais ou comerciais",
	"Use OpenCut for client work and paid projects":
		"Usar o OpenCut em trabalhos para clientes e projetos pagos",
	"Share and distribute videos created with OpenCut":
		"Compartilhar e distribuir vídeos criados com o OpenCut",
	"Modify and distribute the OpenCut software (under MIT license)":
		"Modificar e distribuir o software OpenCut nos termos da licença MIT",
	"You're responsible for how you use OpenCut and the content you create. Don't use it for anything illegal in your jurisdiction.":
		"Você é responsável pela forma como usa o OpenCut e pelo conteúdo que cria. Não o utilize para atividades ilegais em sua jurisdição.",
	"AI features like auto captions run entirely in your browser using on-device models. No content is uploaded to any server. These features are optional - you can use OpenCut without them.":
		"Recursos de IA, como legendas automáticas, funcionam inteiramente no navegador usando modelos executados no dispositivo. Nenhum conteúdo é enviado a servidores. Esses recursos são opcionais — você pode usar o OpenCut sem eles.",
	'OpenCut does not currently require an account. The service is provided "as is" without warranties. While we strive for reliability, we can\'t guarantee uninterrupted service.':
		"Atualmente, o OpenCut não exige uma conta. O serviço é fornecido “no estado em que se encontra”, sem garantias. Embora busquemos confiabilidade, não podemos garantir funcionamento ininterrupto.",
	"Because OpenCut is open source, you have additional rights:":
		"Como o OpenCut é aberto, você possui direitos adicionais:",
	"Review our code to see exactly how we handle your data":
		"Revisar o código para conferir como tratamos seus dados",
	"Self-host OpenCut on your own servers":
		"Hospedar o OpenCut em seus próprios servidores",
	"Modify the software to suit your needs":
		"Modificar o software para atender às suas necessidades",
	"Contribute improvements back to the community":
		"Contribuir com melhorias para a comunidade",
	"View our source code and license on":
		"Consulte nosso código-fonte e a licença no",
	"OpenCut is provided free of charge. To the extent permitted by law:":
		"O OpenCut é fornecido gratuitamente. Na medida permitida pela lei:",
	"We're not liable for any loss of data or content":
		"Não nos responsabilizamos por perda de dados ou conteúdo",
	"Projects are stored in your browser and may be lost if you clear browser data":
		"Os projetos são armazenados no navegador e podem ser perdidos se você apagar os dados dele",
	"We're not responsible for how you use the service":
		"Não somos responsáveis pela forma como você usa o serviço",
	"Our liability is limited to the maximum extent allowed by law":
		"Nossa responsabilidade é limitada ao máximo permitido pela lei",
	"Since your content stays on your device, we have no way to recover lost projects. Consider exporting important videos when finished editing.":
		"Como o conteúdo fica no seu dispositivo, não temos como recuperar projetos perdidos. Considere exportar vídeos importantes ao concluir a edição.",
	"We may update OpenCut and these terms:":
		"Podemos atualizar o OpenCut e estes termos:",
	"We'll notify you of significant changes to these terms":
		"Avisaremos sobre alterações importantes nestes termos",
	"Continued use means you accept any updates":
		"Continuar usando o serviço significa aceitar as atualizações",
	"You can always self-host an older version if you prefer":
		"Você sempre pode hospedar uma versão anterior, se preferir",
	"Major changes will be discussed with the community on GitHub":
		"Alterações importantes serão discutidas com a comunidade no GitHub",
	"You can stop using OpenCut at any time:":
		"Você pode deixar de usar o OpenCut a qualquer momento:",
	"Clear your browser data to remove local projects":
		"Apague os dados do navegador para remover os projetos locais",
	"Contact us through our": "Entre em contato pelo nosso",
	"These terms are governed by applicable law in your jurisdiction. We prefer to resolve disputes through friendly discussion in our open-source community.":
		"Estes termos são regidos pela legislação aplicável em sua jurisdição. Preferimos resolver controvérsias por meio de diálogo amigável em nossa comunidade de código aberto.",

	// Roadmap, contributors, sponsors, blog, and brand
	"What's coming next for OpenCut (last updated: February 25, 2026)":
		"Próximos passos do OpenCut (última atualização: 25 de fevereiro de 2026)",
	Start: "Início",
	Completed: "Concluído",
	"In progress": "Em andamento",
	"Not started": "Não iniciado",
	"Core UI": "Interface principal",
	"Essential functionality": "Funcionalidades essenciais",
	"Native app (mobile/desktop)": "Aplicativo nativo (celular/computador)",
	"This is where it all started. Repository created, initial project structure, and the vision for a free, open-source video editor.":
		"Foi aqui que tudo começou: criação do repositório, estrutura inicial do projeto e a visão de um editor de vídeo gratuito e aberto.",
	"Check out the first tweet": "Veja a primeira publicação",
	"to see where it started.": "para conhecer o começo da história.",
	"Build the foundation - main layout, header, sidebar, timeline container, and basic component structure. Not all functionality yet, but the UI framework that everything else builds on.":
		"Construir a base: layout principal, cabeçalho, barra lateral, contêiner da linha do tempo e estrutura dos componentes. Ainda sem todas as funções, mas com a interface sobre a qual o restante será desenvolvido.",
	"Everything that makes a video editor": "Tudo o que torna um editor de vídeo",
	useful: "útil",
	". Timeline interactivity, storage, effects, transitions, etc.":
		". Interatividade na linha do tempo, armazenamento, efeitos, transições e muito mais.",
	"Native OpenCut apps for Mac, Windows, Linux, and iOS/Android.":
		"Aplicativos nativos do OpenCut para Mac, Windows, Linux, iOS e Android.",
	"OpenCut is open source and built by the community. Every contribution, no matter how small, helps us build the best free video editor possible.":
		"O OpenCut é aberto e desenvolvido pela comunidade. Toda contribuição, por menor que seja, ajuda a criar o melhor editor de vídeo gratuito possível.",
	"Meet the amazing people who contribute to OpenCut, the free and open-source video editor.":
		"Conheça as pessoas incríveis que colaboram com o OpenCut, o editor de vídeo gratuito e de código aberto.",
	"Leading the way in contributions": "Liderando as contribuições",
	"Everyone who makes OpenCut better":
		"Todas as pessoas que tornam o OpenCut melhor",
	"OpenCut is built by developers like you. Every contribution, no matter how small, helps make video editing more accessible for everyone.":
		"O OpenCut é desenvolvido por pessoas como você. Toda contribuição, por menor que seja, ajuda a tornar a edição de vídeo mais acessível.",
	"Modern headless CMS for content management and the blog for OpenCut":
		"CMS headless moderno para gerenciar conteúdo e o blog do OpenCut",
	"GDPR compliant analytics and user insights for OpenCut":
		"Análises e informações de uso do OpenCut em conformidade com o GDPR",
	"Generative image, video, and audio models all in one place.":
		"Modelos generativos de imagem, vídeo e áudio em um só lugar.",
	"Platform where we deploy and host OpenCut.":
		"Plataforma em que implantamos e hospedamos o OpenCut.",
	"Use the symbol on its own when the OpenCut name is already present nearby or space is limited.":
		"Use o símbolo isoladamente quando o nome OpenCut já estiver próximo ou quando houver pouco espaço.",
	Lockup: "Assinatura completa",
	"The full lockup combines the symbol and wordmark. Prefer this in most contexts where you have enough horizontal space.":
		"A assinatura completa combina o símbolo e o nome. Prefira esta versão quando houver espaço horizontal suficiente.",
	"OpenCut is open source — the code is free to use under its license. That license does not cover the name or logo. You can say you use OpenCut, that your project integrates with OpenCut, or that it was built on top of OpenCut. You cannot name your product OpenCut, imply we made or endorse your product, or use the marks commercially without asking first. For anything unclear, reach out at":
		"O OpenCut é aberto — o código pode ser usado conforme sua licença. A licença não cobre o nome nem o logotipo. Você pode informar que usa o OpenCut, que seu projeto se integra a ele ou que foi construído sobre ele. Não é permitido chamar seu produto de OpenCut, sugerir que o projeto foi criado ou endossado por nós, nem usar as marcas comercialmente sem autorização. Em caso de dúvida, escreva para",
	"Using OpenCut in the name of your product, service, or domain.":
		"Usar OpenCut no nome do seu produto, serviço ou domínio.",
	"Implying that OpenCut made, sponsors, or endorses your work.":
		"Sugerir que o OpenCut criou, patrocina ou endossa seu trabalho.",
	"Using the logo or name on merchandise or commercial marketing.":
		"Usar o logotipo ou o nome em produtos ou divulgação comercial.",
	"Modifying the marks.": "Modificar as marcas.",
	"Read the latest news and updates about OpenCut, the free and open-source video editor.":
		"Leia as últimas notícias e atualizações do OpenCut, o editor de vídeo gratuito e de código aberto.",

	// Additional editor controls and status messages
	"Background Color": "Cor do plano de fundo",
	"Background Enabled": "Plano de fundo ativado",
	"Background Offset X": "Deslocamento horizontal do plano de fundo",
	"Background Offset Y": "Deslocamento vertical do plano de fundo",
	"Background Padding X": "Espaçamento horizontal do plano de fundo",
	"Background Padding Y": "Espaçamento vertical do plano de fundo",
	"Background Radius": "Raio do plano de fundo",
	"Breaking Changes": "Alterações incompatíveis",
	Features: "Novidades",
	Fixes: "Correções",
	Improvements: "Melhorias",
	"Technical details": "Detalhes técnicos",
	Checkerboard: "Quadriculado",
	Grid: "Grade",
	Heart: "Coração",
	Heavy: "Intenso",
	Hexagon: "Hexágono",
	"Higher accuracy, slower": "Maior precisão, mais lento",
	"Hold segments have a fixed value - easing has no effect here.":
		"Segmentos de retenção têm valor fixo; a suavização não produz efeito aqui.",
	Hue: "Matiz",
	"In out": "Entrada e saída",
	Inside: "Interno",
	Intensity: "Intensidade",
	Italic: "Itálico",
	"Letter spacing": "Espaçamento entre letras",
	"Letter Spacing": "Espaçamento entre letras",
	"Line height": "Altura da linha",
	"Line Height": "Altura da linha",
	"Line Through": "Tachado",
	Linear: "Linear",
	"Loading fonts...": "Carregando fontes...",
	"Loading more sounds...": "Carregando mais sons...",
	"Loading saved sounds...": "Carregando sons salvos...",
	Logo: "Logotipo",
	Luminosity: "Luminosidade",
	Medium: "Médio",
	Mirror: "Espelhar",
	Muted: "Silenciado",
	"My fonts": "Minhas fontes",
	"No fonts found.": "Nenhuma fonte encontrada.",
	"No scenes available": "Nenhuma cena disponível",
	None: "Nenhum",
	"Not now": "Agora não",
	"Only one mask is supported right now. If you need more, duplicate the clip and apply a different mask to each copy.":
		"No momento, apenas uma máscara é aceita. Se precisar de mais, duplique o clipe e aplique uma máscara diferente em cada cópia.",
	"Open effects": "Abrir efeitos",
	"OpenCut isn't optimized for mobile or iPad yet. Things will break and the layout will be a mess. Come back on a desktop for the real experience.":
		"O OpenCut ainda não foi otimizado para celulares ou iPad. Alguns recursos e o layout podem não funcionar. Use um computador para ter a experiência completa.",
	Outside: "Externo",
	"Paste elements": "Colar elementos",
	"Pen tool": "Ferramenta caneta",
	"Plus Lighter": "Clarear por adição",
	Points: "Pontos",
	Pop: "Salto",
	Ripple: "Edição ripple",
	Saturation: "Saturação",
	"Select a mode": "Selecione um modo",
	"Clear input": "Limpar campo",
	"OpenCut Logo": "Logotipo do OpenCut",
	"Text height": "Altura do texto",
	"Text width": "Largura do texto",
	results: "resultados",
	saved: "salvos",
	"Pattern craft": "Padrões artesanais",
	"Syntax UI": "Interface sintática",
	"Song search functionality is coming soon. Try searching for sound effects instead.":
		"A pesquisa de músicas estará disponível em breve. Por enquanto, pesquise efeitos sonoros.",
	"Selected properties do not share a graph-editable channel.":
		"As propriedades selecionadas não compartilham um canal editável no gráfico.",
	"Stroke Align": "Alinhamento do contorno",
	"The selected keyframe could not be resolved.":
		"Não foi possível localizar o quadro-chave selecionado.",
	"The selected keyframe has no editable graph channel.":
		"O quadro-chave selecionado não possui um canal de gráfico editável.",
	"The selected keyframe has no editable graph.":
		"O quadro-chave selecionado não possui um gráfico editável.",
	"The selected keyframe is not editable as a graph segment.":
		"O quadro-chave selecionado não pode ser editado como segmento de gráfico.",
	"Learn how OpenCut handles your data and privacy. Our commitment to protecting your information while you edit videos.":
		"Saiba como o OpenCut trata seus dados e sua privacidade enquanto você edita vídeos.",
	"OpenCut's Terms of Service. Fair, transparent terms for our free and open-source video editor.":
		"Termos de Serviço do OpenCut: condições justas e transparentes para nosso editor de vídeo gratuito e de código aberto.",
	"See what's coming next for OpenCut - the free, open-source video editor that respects your privacy.":
		"Veja as próximas novidades do OpenCut, o editor de vídeo gratuito e aberto que respeita sua privacidade.",
};

export const EN_MESSAGES = Object.fromEntries(
	Object.keys(PT_BR_MESSAGES).map((message) => [message, message]),
) as Record<string, string>;
