# Rascunhos gráficos e recuperação — 12/10/2026

Origem: Alex solicitou preservação ao trocar de ferramenta, rascunhos automáticos e recuperação em caso de erro. A primeira fatia cobre a página Ferramentas Gráficas; outras páginas ainda precisam de revisão própria.

Os editores visitados permanecem montados durante a troca de abas. Estados principais dos nove editores são recuperados antes da montagem e persistidos em IndexedDB, separados por empresa e usuário. Arquivos importados por URLs temporárias são arquivados como Blobs e recebem novas URLs ao recuperar. Reprodução e atalhos do MMFilm ficam inativos quando a ferramenta está oculta.

O autosave aguarda 400 ms depois da última alteração e mostra salvando/salvo/erro. A transação conserva o snapshot anterior junto do novo snapshot. Falha de leitura não autoriza sobrescrever rascunhos desconhecidos. Falha na gravação não declara sucesso. Ao sair da rota ou ocultar a página, inicia uma última gravação; fechamento abrupto durante a gravação ainda pode perder alterações mais recentes.

Controles: Baixar recuperação exporta JSON versionado com os arquivos de mídia embutidos; Abrir recuperação valida o schema antes de substituir o estado; Restaurar cópia anterior recupera o último snapshot anterior. Ambas as restaurações conservam o estado substituído como backup e solicitam confirmação. Não é histórico ilimitado: dois snapshots locais. Não é sincronização com servidor nem garantia contra limpeza de dados do navegador, quota, falha de disco ou edição concorrente em várias abas. Baixar arquivo de recuperação fornece cópia independente do navegador.

O arquivo de recuperação contém trabalhos/mídias e deve ser tratado como conteúdo da empresa. Não contém chaves de IA. As chaves desta fatia de armazenamento são distintas do salvamento manual antigo do MMFilm, que ainda exige revisão de portabilidade. Propriedades centrais, timelines, keyframes, formas, camadas, ajustes e cenas são persistidas; estados de subpainéis não relacionados ao documento permanecem transitórios para evitar colisões entre instâncias.

Verificação: regressão de troca MM3D → MMPhoto → MM3D conserva objeto editado; testes de armazenamento recuperam após desmontagem, isolam empresa/usuário, arquivam mídia, restauram cópia anterior e informam armazenamento indisponível. Verificar lint/build e suíte geral antes de publicação. M0 não é promovido por esta fatia.

Rollback: remover o provider/hook e retornar ao estado anterior dos editores preserva o banco IndexedDB e os arquivos baixados, mas volta a perder alterações ao trocar de ferramenta. Nunca apagar o armazenamento de rascunhos como passo de rollback.
