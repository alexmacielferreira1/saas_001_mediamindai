# MediaMindAI — arquivos para atualização do módulo de thumbs

Este pacote foi preparado a partir do ZIP enviado. Ele contém apenas arquivos alterados ou novos, mantendo a organização do repositório. Não foi publicado nem enviado ao GitHub.

## Como substituir no VS Code

1. Faça uma cópia do projeto atual ou abra uma branch para esta atualização.
2. Extraia `MediaMindAI_ajustes_thumbs.zip`. A pasta `frontend` do pacote corresponde à pasta `frontend` do seu repositório; o mesmo vale para `backend`.
3. Para cada linha da tabela abaixo, substitua o arquivo existente pelo arquivo de mesmo caminho do pacote. Se estiver marcado como “Criar”, crie o arquivo e suas pastas. No vscode.dev, use Ctrl+P para localizar o caminho e cole TODO o conteúdo do arquivo recebido. Para PNG e TTF, envie o arquivo binário original: não cole texto.
4. Inclua todos os arquivos desta atualização no mesmo commit. Frontend, backend, fontes e logos funcionam em conjunto. Não substitua somente a página ThumbnailStudio.
5. Configure o servidor conforme a seção abaixo e publique pelo fluxo que seu projeto já usa.

Os caminhos são relativos à raiz `saas_001_mediamindai-main`, onde ficam `pyproject.toml`, `frontend` e `backend`. Não copie a pasta `entrega-thumbs` para dentro do projeto. Não envie node_modules, dist ou arquivos temporários.

## Alterações implementadas

- Um único campo de chamada, com composição e quebra de texto atualizadas durante a digitação.
- Cadastro e seleção de uma ou várias pessoas, incluindo participantes dos projetos; nomes e fotos têm controles independentes.
- Envio de foto com recorte automático de fundo no backend, estados de processamento/erro, repetição e comparação com o original.
- Enquadramento inicial de retrato para imagens altas, com zoom, posição vertical, espelhamento e opção de corpo inteiro.
- Logos oficiais recebidos, fontes locais com suas licenças, sombras, contorno, cores e ondas do fundo.
- Editor com arraste, posição, dimensões, rotação, ordem, opacidade, alinhamento, bloqueio e ocultação; desfazer/refazer e restauração por camada, formato ou composição.
- Fontes e efeitos podem ser salvos como padrão do projeto.
- Preview e exportação usam o mesmo renderizador de pixels. PNG horizontal 1920×1080 e vertical 1080×1920 incluem ondas, fotos e logos.
- Composição salva em CreativeDocument, arquivos em Asset, versões anteriores preservadas e associação ao projeto ProducaoProjeto.
- Galeria de thumbs vinculadas ao projeto nos detalhes de produção, agendamento e publicações; é possível reabrir uma composição e selecionar a imagem para publicação ou capa do projeto.
- Configuração administrativa do recorte por modelo local ou remove.bg, com chave criptografada, teste da configuração e limite mensal de tentativas externas. Não há credenciais no navegador ou no repositório.

## Configuração necessária no servidor

As alterações usam tabelas existentes de registros e mídia. Não há nova migração de banco neste pacote. Mantenha o banco persistente e o fluxo de migração já usado no projeto.

Instale as dependências do backend a partir do `requirements.lock` atualizado, ou use o processo de instalação por `pyproject.toml` do seu deploy. Foram acrescentadas cryptography e httpx como dependências de execução. Não precisa substituir package.json ou package-lock.json do frontend.

Para guardar uma chave de API externa, gere uma chave Fernet no terminal:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Cadastre o resultado como variável de ambiente `THUMBNAIL_SECRET_KEY` no servidor. Guarde uma cópia segura e mantenha a mesma chave nos próximos deploys: trocar essa chave impede a leitura das credenciais já criptografadas. Não coloque o valor real em `.env.example`, GitHub ou código do frontend.

Configure `MEDIA_ROOT` para um diretório em armazenamento persistente. O backend deste projeto guarda as imagens em disco; com disco temporário elas podem sumir em um novo deploy, mesmo que o vínculo continue no banco. A permanência dos arquivos depende dessa configuração e de backups.

No módulo de thumbs, um usuário com permissão `permissions.manage` pode escolher:

- **Local:** usa rembg, sem chave paga. A primeira execução baixa o modelo. O servidor precisa de memória, acesso ao download e tempo suficiente para processar. Há modelos ISNet e u2netp; o último é mais leve. O download e a qualidade do modelo não foram validados no seu servidor.
- **remove.bg:** informe sua chave e salve. O teste consulta a conta; o recorte real depende de créditos, conectividade e limites do provedor. O limite do aplicativo conta tentativas externas e não substitui o saldo/faturamento do provedor. As respostas externas foram testadas com simulação, sem consumir seus créditos.

## O que ainda requer validação ou material

- O arquivo disponível do logo Canal SIMERS é pequeno (92×48). Foi incluído um campo para carregar e salvar o novo logo, mas não havia um arquivo independente em alta do canal para substituir automaticamente.
- Não vieram logos oficiais independentes de Pediatrando e Ética Médica. O sistema permite envio do logo. Em Debate está disponível como programa e logo, mas sua paleta começa neutra para você ajustar: não foi inventado um padrão oficial.
- As fontes locais são Anton, Montserrat e Archivo Black, além das alternativas do sistema. Não foi possível comprovar a fonte exata de cada referência. Você pode escolher a fonte e salvar o padrão do projeto.
- O enquadramento inicial usa proporção e corte superior da foto, não um detector semântico de corpo/rosto. Há ajuste manual quando o resultado precisar de correção. Uma foto com várias pessoas permanece um recorte conjunto; não há separação automática de cada pessoa.
- O editor cobre os ajustes listados acima. Não é uma implementação completa do Canva e não inclui máscara com pincel, grupos ou edição vetorial livre.
- O processamento simultâneo é limitado por processo do servidor; solicitações iguais concorrentes em vários workers ainda podem gerar mais de uma chamada externa.
- A listagem de composições usa os 500 registros mais recentes retornados pela API existente. Bibliotecas maiores precisam de paginação específica.
- Não foi validado o fluxo inteiro no navegador do seu site publicado nem um recorte pago com sua conta. Isso precisa ser conferido após instalar os arquivos.

## Verificações executadas

- Frontend: suíte completa com 336 testes aprovados, mais 4 testes de persistência adicionados na finalização.
- Backend: suíte completa com 178 testes aprovados e 2 ignorados por dependerem de PostgreSQL; 15 testes de mídia/configuração repetidos após os ajustes finais.
- Lint, typecheck e build do frontend aprovados. O build conserva avisos de tamanho de bundle e de importação dinâmica do projeto.
- Imagens horizontal e vertical renderizadas e inspecionadas usando o renderizador real, verificando ondas, fontes, composição e dimensões.
- Os scripts PowerShell de verificação do repositório não foram executados neste ambiente Linux. Não se alterou o marco de aprovação nem se publicou a aplicação.

Depois de instalar, confira no seu ambiente: selecionar projeto e dois entrevistados; enviar foto nova; validar o recorte; ajustar e restaurar; salvar composição; exportar os dois formatos; recarregar e reabrir a composição; selecionar a thumb em uma publicação; confirmar acesso limitado às chaves de IA.

## Arquivos — um por um

| Ação | Caminho exato no projeto | Arquivo do pacote |
|---|---|---|
| Substituir | `.env.example` | [.env.example](.env.example) |
| Substituir | `backend/app/api/v1/__init__.py` | [__init__.py](backend/app/api/v1/__init__.py) |
| Substituir | `backend/app/api/v1/media.py` | [media.py](backend/app/api/v1/media.py) |
| Substituir | `backend/app/api/v1/records.py` | [records.py](backend/app/api/v1/records.py) |
| Criar | `backend/app/api/v1/thumbnail_settings.py` | [thumbnail_settings.py](backend/app/api/v1/thumbnail_settings.py) |
| Substituir | `backend/app/core/config.py` | [config.py](backend/app/core/config.py) |
| Substituir | `backend/app/services/background_removal.py` | [background_removal.py](backend/app/services/background_removal.py) |
| Substituir | `backend/app/tenancy/record_policies.py` | [record_policies.py](backend/app/tenancy/record_policies.py) |
| Criar | `backend/tests/test_thumbnail_settings_api.py` | [test_thumbnail_settings_api.py](backend/tests/test_thumbnail_settings_api.py) |
| Criar | `frontend/public/brand/programs/Anamnese.png` | [Anamnese.png](frontend/public/brand/programs/Anamnese.png) |
| Criar | `frontend/public/brand/programs/Coracoes_e_Mentes.png` | [Coracoes_e_Mentes.png](frontend/public/brand/programs/Coracoes_e_Mentes.png) |
| Criar | `frontend/public/brand/programs/Em_Debate.png` | [Em_Debate.png](frontend/public/brand/programs/Em_Debate.png) |
| Criar | `frontend/public/brand/programs/Fronteiras_da_Saude.png` | [Fronteiras_da_Saude.png](frontend/public/brand/programs/Fronteiras_da_Saude.png) |
| Criar | `frontend/public/brand/programs/No_Front.png` | [No_Front.png](frontend/public/brand/programs/No_Front.png) |
| Criar | `frontend/public/brand/programs/Plantao_do_Rock.png` | [Plantao_do_Rock.png](frontend/public/brand/programs/Plantao_do_Rock.png) |
| Criar | `frontend/public/brand/programs/Prontuario_Juridico.png` | [Prontuario_Juridico.png](frontend/public/brand/programs/Prontuario_Juridico.png) |
| Criar | `frontend/public/brand/programs/SOLIDARIZA.png` | [SOLIDARIZA.png](frontend/public/brand/programs/SOLIDARIZA.png) |
| Criar | `frontend/public/brand/programs/Sala_de_Prescricao.png` | [Sala_de_Prescricao.png](frontend/public/brand/programs/Sala_de_Prescricao.png) |
| Criar | `frontend/public/fonts/Anton-LICENSE.txt` | [Anton-LICENSE.txt](frontend/public/fonts/Anton-LICENSE.txt) |
| Criar | `frontend/public/fonts/Anton.ttf` | [Anton.ttf](frontend/public/fonts/Anton.ttf) |
| Criar | `frontend/public/fonts/ArchivoBlack-LICENSE.txt` | [ArchivoBlack-LICENSE.txt](frontend/public/fonts/ArchivoBlack-LICENSE.txt) |
| Criar | `frontend/public/fonts/ArchivoBlack.ttf` | [ArchivoBlack.ttf](frontend/public/fonts/ArchivoBlack.ttf) |
| Criar | `frontend/public/fonts/Montserrat-LICENSE.txt` | [Montserrat-LICENSE.txt](frontend/public/fonts/Montserrat-LICENSE.txt) |
| Criar | `frontend/public/fonts/Montserrat.ttf` | [Montserrat.ttf](frontend/public/fonts/Montserrat.ttf) |
| Substituir | `frontend/src/api/media.js` | [media.js](frontend/src/api/media.js) |
| Substituir | `frontend/src/mediamind/components/corp/CorpProductionDetail.jsx` | [CorpProductionDetail.jsx](frontend/src/mediamind/components/corp/CorpProductionDetail.jsx) |
| Substituir | `frontend/src/mediamind/components/corp/CorpPublications.jsx` | [CorpPublications.jsx](frontend/src/mediamind/components/corp/CorpPublications.jsx) |
| Substituir | `frontend/src/mediamind/components/corp/roles/AgendamentoDetail.jsx` | [AgendamentoDetail.jsx](frontend/src/mediamind/components/corp/roles/AgendamentoDetail.jsx) |
| Criar | `frontend/src/mediamind/components/thumbnails/ProjectThumbnails.jsx` | [ProjectThumbnails.jsx](frontend/src/mediamind/components/thumbnails/ProjectThumbnails.jsx) |
| Criar | `frontend/src/mediamind/components/thumbnails/ThumbnailAISettings.jsx` | [ThumbnailAISettings.jsx](frontend/src/mediamind/components/thumbnails/ThumbnailAISettings.jsx) |
| Substituir | `frontend/src/mediamind/components/thumbnails/ThumbnailCanvas.jsx` | [ThumbnailCanvas.jsx](frontend/src/mediamind/components/thumbnails/ThumbnailCanvas.jsx) |
| Substituir | `frontend/src/mediamind/components/thumbnails/ThumbnailCanvas.test.jsx` | [ThumbnailCanvas.test.jsx](frontend/src/mediamind/components/thumbnails/ThumbnailCanvas.test.jsx) |
| Criar | `frontend/src/mediamind/components/thumbnails/ThumbnailTools.jsx` | [ThumbnailTools.jsx](frontend/src/mediamind/components/thumbnails/ThumbnailTools.jsx) |
| Substituir | `frontend/src/mediamind/lib/producaoStore.js` | [producaoStore.js](frontend/src/mediamind/lib/producaoStore.js) |
| Substituir | `frontend/src/mediamind/lib/thumbnailExport.js` | [thumbnailExport.js](frontend/src/mediamind/lib/thumbnailExport.js) |
| Substituir | `frontend/src/mediamind/lib/thumbnailExport.test.js` | [thumbnailExport.test.js](frontend/src/mediamind/lib/thumbnailExport.test.js) |
| Criar | `frontend/src/mediamind/lib/thumbnailPersistence.js` | [thumbnailPersistence.js](frontend/src/mediamind/lib/thumbnailPersistence.js) |
| Criar | `frontend/src/mediamind/lib/thumbnailPersistence.test.js` | [thumbnailPersistence.test.js](frontend/src/mediamind/lib/thumbnailPersistence.test.js) |
| Criar | `frontend/src/mediamind/lib/thumbnailRenderer.js` | [thumbnailRenderer.js](frontend/src/mediamind/lib/thumbnailRenderer.js) |
| Substituir | `frontend/src/mediamind/lib/thumbnailStudio.js` | [thumbnailStudio.js](frontend/src/mediamind/lib/thumbnailStudio.js) |
| Substituir | `frontend/src/mediamind/lib/thumbnailStudio.test.js` | [thumbnailStudio.test.js](frontend/src/mediamind/lib/thumbnailStudio.test.js) |
| Substituir | `frontend/src/mediamind/pages/ThumbnailStudio.jsx` | [ThumbnailStudio.jsx](frontend/src/mediamind/pages/ThumbnailStudio.jsx) |
| Substituir | `frontend/src/mediamind/pages/ThumbnailStudio.test.jsx` | [ThumbnailStudio.test.jsx](frontend/src/mediamind/pages/ThumbnailStudio.test.jsx) |
| Substituir | `pyproject.toml` | [pyproject.toml](pyproject.toml) |
| Substituir | `requirements.lock` | [requirements.lock](requirements.lock) |

## Reversão

Para reverter o código, restaure os arquivos substituídos a partir do ZIP original e remova os novos arquivos deste pacote. Preserve o banco, os arquivos de mídia e a chave de criptografia; não apague os registros de versões para reverter uma interface.
