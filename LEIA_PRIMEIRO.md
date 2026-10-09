# MediaMindAI — frontend completo conferido no ZIP (3)

## Problema comprovado

O ZIP `saas_001_mediamindai-main(3).zip` (snapshot `192289e4df3b405ba8978983315e84bab90f5520`) tinha apenas **29 arquivos em frontend/src**. Faltavam main.jsx, App.jsx, os clientes de API, CSS e centenas de componentes. O index.html aponta para main.jsx: essa estrutura não compila. Um deploy que falha não publica os ajustes; a última versão publicada pode continuar no site.

Havia também arquivos de thumbs, testes, logos e fontes soltos na raiz de frontend. Essas cópias estão fora dos caminhos importados pelo aplicativo: editar uma delas não altera a tela.

## Correção

Recuperei 377 arquivos ausentes da entrega completa anterior, mantendo os arquivos novos das ferramentas deste ZIP e as correções anteriores de rotas/recorte. A pasta entregue é um **frontend completo**, não um pacote parcial.

| Item | Caminho correto |
|---|---|
| Entrada | frontend/src/main.jsx |
| Rotas | frontend/src/App.jsx |
| Editor SIMERS | frontend/src/mediamind/pages/ThumbnailStudio.jsx |
| Ferramentas | frontend/src/mediamind/pages/AITools.jsx |
| Recorte | frontend/src/mediamind/lib/personSegmentation.js |
| Adaptador | frontend/src/mediamind/lib/thumbnailImage.js |
| Modelo incluído | frontend/public/models/selfie_segmenter.tflite |
| Motor incluído | frontend/public/vision/wasm/ |
| Preparação automática | frontend/scripts/prepare-person-segmentation.mjs |
| Logos | frontend/public/brand/programs/ |
| Fontes | frontend/public/fonts/ |
| Controles das ferramentas | frontend/src/mediamind/components/ai-tools/ |

/thumbnails e a aba padrão de /ferramentas-ia usam o mesmo ThumbnailStudio. O gerador de três variações continua na aba separada. Os formulários novos de Molduras, Radar, Dublagem, Voz, Animação, Canais e vídeo foram mantidos.

O modelo e o WASM passam a ser servidos pelo próprio frontend, eliminando os downloads do Google/jsDelivr durante o recorte. A foto local é processada no navegador sem chamar o endpoint de remoção de fundo do backend. Acesso ao acervo, cadastro de pessoas e salvamento continuam sujeitos às permissões normais.

## Instalação

Este pacote substitui as instruções de instalar vários ZIPs parciais.

1. Extraia o ZIP em uma pasta temporária.
2. **Mescle a pasta frontend do pacote com frontend na raiz do repositório**, substituindo os arquivos correspondentes. Preserve qualquer .env/.env.local existente. Não jogue os arquivos JSX na raiz de frontend.
3. Alternativa no Windows: execute o instalador incluído. Ele valida o destino, faz backup dos arquivos substituídos e copia mantendo os subdiretórios:

```powershell
.\APLICAR_FRONTEND.ps1 -Projeto "C:\Users\Alex\Desktop\HUB_SAAS\001_mediamindai"
```

O script exige PowerShell local; não é um comando do vscode.dev. Não faz commit, push ou deploy.

4. Dentro de frontend, execute:

```bash
npm ci
npm test
npm run lint
npm run build
```

5. Faça commit e push de **todos** os arquivos copiados. Publique o serviço frontend no Render. O comando npm ci && npm run build prepara os recursos WASM automaticamente.

Não substitua o backend: não há alteração de banco ou migration neste pacote.

## Confirmar a publicação

Depois do deploy bem-sucedido, abra **/app-release.json** no domínio do frontend. O campo release deve ser:

`2026-10-09-frontend-completo-recorte-local`

Se não aparecer, esta entrega ainda não chegou ao serviço. Depois teste uma foto local: deverá mostrar “Recortando fundo…” e a opção de comparar com a original. Em caso de falha, a imagem original é preservada e o erro é mostrado. Não é necessária chave de IA para esse recorte.

## Evidências e limites

- npm ci aprovado: 703 pacotes.
- Build do aplicativo inteiro aprovado, com main.jsx, App.jsx e todas as importações. Permanecem avisos existentes de bundle grande e import dinâmico ineficaz.
- **83 arquivos / 370 testes únicos aprovados**. As cópias duplicadas da raiz não são implementações concorrentes; os testes efetivos estão em src.
- Lint completo aprovado.
- Comando typecheck existente aprovado, mas seu jsconfig tem escopo limitado: não equivale a tipar todo o MediaMind.
- Recorte: máscara, composição transparente, geração de PNG, identificação ausente, nova tentativa após falha do modelo e ausência de chamada ao backend cobertos por testes.
- Logos e fontes soltos comparados com os arquivos nos caminhos corretos: conteúdo idêntico.
- Backend: 64 módulos Python analisados; nenhuma importação local ausente, inclusive admin_settings e core.errors. Suíte backend não executada: pytest indisponível no Python deste ambiente. Backend não alterado.

Os testes de recorte simulam o adaptador do modelo e não comprovam qualidade para qualquer foto. A validação visual local não foi possível: o navegador remoto não alcança o localhost do ambiente de código. A tentativa de login foi cancelada como solicitado. Não houve deploy, alteração do GitHub, acesso ao banco de produção ou mudança de permissões.

Geração final de MP4, clonagem de voz e motores automáticos das demais ferramentas ficam fora do escopo escolhido: remover fundo e frontend das ferramentas.

Modelo oficial: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite

SHA-256: 191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b

Motor: @mediapipe/tasks-vision 0.10.32, já presente nas dependências do ZIP.
