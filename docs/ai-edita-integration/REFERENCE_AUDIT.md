# Auditoria da referência AI Edita

Atualizado em 29/09/2026.

## Objetivo

Usar o AI Edita como referência técnica e funcional para enriquecer o MediaMind AI, preservando a arquitetura React/Vite + FastAPI/SQLAlchemy/PostgreSQL, a identidade visual, as rotas e as capacidades existentes.

A regra é **preservar → comparar → adaptar → implementar → testar → documentar**. Recursos não são considerados implementados apenas porque possuem interface ou botão.

## Fontes

- `C:/Users/Alex/Downloads/AI-Edita-Windows-x64.zip`
- `C:/Users/Alex/Downloads/AI-Edita-Legendas-Pro-v2.aiedita`
- `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md`
- `docs/superpowers/specs/2026-09-27-mediamind-editor-operations-ai-edita-integration-design.md`
- `docs/prompts/INTEGRAR_AI_EDITA_MEDIAMIND.md`

## Regras de incorporação

1. Não copiar marca, identidade, logos ou assets sem licença verificada.
2. Não substituir a stack nem criar arquitetura paralela desnecessária.
3. Reutilizar contratos e componentes MediaMind existentes.
4. Persistência, autorização e auditoria pertencem ao backend.
5. IA gera planos editáveis, rastreáveis e reversíveis.
6. Timeline e Cortes devem convergir para a mesma engine.
7. Um mesmo `MediaAsset` atravessa Pesquisa, Roteiro, Timeline, Revisão, Exportação e Publicação.

## Áreas encontradas

| Capacidade | Destino MediaMind | Estado atual |
|---|---|---|
| Timeline multitrack e comandos | Workspace 2 / Timeline | Parcial |
| Player, playhead, seek e lacunas | Players compartilhados | Parcial |
| Snapping e marcadores | Timeline / Aprovação | Parcial |
| Keyframes, easing e curvas | Inspector / animação | Parcial |
| Legendas e Style Packs | Timeline / Cortes / Brand Kit | Parcial |
| Waveform e ferramentas de áudio | Timeline / mixer | Pendente |
| Efeitos, máscaras e Graph Editor | Inspector profissional | Pendente |
| Templates e edição por prompt | Creative Engine | Pendente |
| Transcrição e edição por IA | Decupagem / Cortes / Timeline | Pendente |
| Exportação e render | Passo 5 / Finalizado | Parcial |
| Tema e preferências | Produto inteiro | Pendente |
| Atalhos, menus e painéis | Produto inteiro / editor | Parcial |

O inventário detalhado continua em `docs/AI_EDITA_INVENTARIO_E_MATRIZ.md`; esta auditoria é a porta de entrada canônica da integração.
