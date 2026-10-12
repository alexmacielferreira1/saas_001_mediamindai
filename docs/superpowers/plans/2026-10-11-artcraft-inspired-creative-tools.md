# ArtCraft-inspired Creative Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar MM3D e quatro estúdios generativos integrados às áreas existentes do MediaMind.

**Architecture:** Componentes React isolados, estado local explícito e registros de navegação existentes. A primeira entrega não chama provedores externos; a camada visual reporta configuração ausente e mantém funcionais as operações locais.

**Tech Stack:** React 18, Vite, Tailwind CSS, Lucide, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-artcraft-inspired-creative-tools-design.md`

## Global Constraints

- Alterar somente `001_mediamindai`.
- Preservar mudanças locais existentes e o comportamento do MMEffect.
- Não executar instaladores nem publicar em produção.
- Não criar respostas falsas de geração.

## Review Focus

- Fidelidade da hierarquia ArtCraft com identidade MediaMind.
- Controles localmente funcionais e acessíveis.
- Regressões na navegação e nos 13 fluxos de IA existentes.

---

### Task 1: Registrar e testar as novas entradas

**Files:**
- Modify: `frontend/src/mediamind/pages/GraphicTools.jsx`
- Modify: `frontend/src/mediamind/pages/GraphicTools.test.jsx`
- Modify: `frontend/src/mediamind/lib/aiToolsRegistry.js`
- Modify: `frontend/src/mediamind/lib/aiToolsRegistry.test.js`
- Modify: `frontend/src/mediamind/pages/AITools.jsx`
- Modify: `frontend/src/mediamind/pages/AITools.test.jsx`

Adicionar MM3D e os quatro estúdios; escrever primeiro expectativas de contagem, rótulos e roteamento; executar os testes focados até passarem.

### Task 2: Construir o workspace MM3D

**Files:**
- Create: `frontend/src/mediamind/components/graphic-tools/ThreeDCraftWorkspace.jsx`
- Create: `frontend/src/mediamind/components/graphic-tools/ThreeDCraftWorkspace.test.jsx`

Implementar grade em perspectiva, câmera, outliner, criação e seleção de objetos, transformação numérica, modos mover/rotacionar/escalar, controles de mundo, proporção e timeline. Cobrir adição, seleção, transformação e avanço temporal.

### Task 3: Construir a base dos estúdios generativos

**Files:**
- Create: `frontend/src/mediamind/components/ai-tools/GenerativeStudio.jsx`
- Create: `frontend/src/mediamind/components/ai-tools/GenerativeStudios.test.jsx`

Criar shell comum com navegação lateral, prompt, referências locais, painel de configurações, custo/quantidade, galeria e estado de provedor não configurado.

### Task 4: Especializar Imagem, Vídeo, Objeto 3D e Mundo 3D

**Files:**
- Modify: `frontend/src/mediamind/components/ai-tools/GenerativeStudio.jsx`
- Modify: `frontend/src/mediamind/pages/AITools.jsx`

Configurar modelos e controles por tipo. Imagem recebe qualidade e resolução; vídeo recebe quadros inicial/final, duração e áudio; objeto recebe entrada texto/imagem e qualidade de malha; mundo recebe referência e navegação do ambiente.

### Task 5: Verificação integrada

**Files:**
- Verify: `frontend/src/mediamind/pages/GraphicTools.test.jsx`
- Verify: `frontend/src/mediamind/pages/AITools.test.jsx`
- Verify: `frontend/src/mediamind/components/graphic-tools/ThreeDCraftWorkspace.test.jsx`
- Verify: `frontend/src/mediamind/components/ai-tools/GenerativeStudios.test.jsx`

Executar testes focados, lint e build. Revisar a aplicação no navegador em `/ferramentas-graficas?tool=threecraft` e `/ferramentas-ia?tool=image-generator`.
