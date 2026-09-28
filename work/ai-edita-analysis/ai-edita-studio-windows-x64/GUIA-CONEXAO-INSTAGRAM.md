# Guia simples de conexão do Instagram

Atualizado em 5 de setembro de 2026 para o AI Edita Studio portátil.

## O que o cliente precisa

- O ZIP completo do AI Edita para Windows ou macOS.
- Google Chrome ou Microsoft Edge.
- Internet no horário da publicação.
- Uma conta profissional do Instagram, do tipo Empresa ou Criador.

O cliente não precisa criar Página do Facebook, configurar Cloudflare, instalar
Node.js nem informar senha do Instagram. O pacote já contém o servidor local, o
SQLite, o agendador e o componente de entrega temporária do vídeo.

No horário agendado, o computador precisa estar ligado, sem suspensão, e o AI
Edita deve continuar aberto.

## 1. Tornar a conta profissional

No aplicativo do Instagram:

1. Abra **Configurações e atividade**.
2. Entre em **Tipo e ferramentas da conta**.
3. Se a conta ainda for pessoal, selecione **Mudar para conta profissional**.
4. Escolha Empresa ou Criador e conclua.

Os nomes dos menus podem variar um pouco entre Android, iPhone e versões do
Instagram.

## 2. Criar o aplicativo na Meta

Esta etapa é feita pelo responsável pelo aplicativo ou durante a configuração
assistida, não em cada publicação.

1. Abra [Meta for Developers — Apps](https://developers.facebook.com/apps/).
2. Clique em **Criar aplicativo**.
3. Escolha o caso de uso da API do Instagram e, se solicitado, o tipo
   Business/Empresa.
4. No painel do aplicativo, abra Instagram e selecione **API setup with
   Instagram login**.
5. Adicione a conta profissional usada no teste.
6. Entre nessa conta do Instagram e autorize o aplicativo.
7. Gere o token e copie também o Instagram Account ID mostrado pela Meta.

Permissões usadas pelo AI Edita:

- `instagram_business_basic`;
- `instagram_business_content_publish`;
- `instagram_business_manage_insights`, para o painel de Insights.

O token deve ser tratado como senha e nunca deve aparecer em aulas, capturas de
tela ou mensagens.

## 3. Conectar no AI Edita

1. Abra **Configurações → Instagram**.
2. Em **Tipo de autorização**, mantenha **Instagram Login**.
3. Cole o Instagram Account ID.
4. Cole o token de acesso.
5. Clique em **Conectar e validar**.
6. Confirme que o perfil correto aparece como conectado.

O token fica no cofre criptografado da máquina. Projetos, agenda e estados de
publicação permanecem no SQLite local.

## 4. Agendar um vídeo

1. Exporte o MP4 e marque **Guardar uma cópia na agenda**, ou importe um MP4
   final na Agenda.
2. Escolha conta, data, horário e legenda.
3. Clique em **Revisar plano**.
4. O AI Edita confere arquivo, vídeo, áudio, conta, token, permissão, quota e a
   entrega HTTPS temporária.
5. Confira o plano e confirme o agendamento.

Nenhum item entra na fila se o pré-voo obrigatório não for aprovado.

## Como o vídeo chega à Meta

No Instagram Login, a API oficial exige que a Meta consiga buscar o vídeo em um
endereço HTTPS público. O AI Edita cuida disso sem configuração do cliente:

1. expõe somente o MP4 confirmado em uma rota aleatória;
2. verifica tipo, tamanho e leitura parcial do arquivo;
3. se a rota oscilar, descarta-a e tenta até três rotas novas por HTTP/2;
4. se a oscilação continuar, mantém o item agendado e tenta novamente sozinho,
   com espera progressiva;
5. cria o contêiner da Meta somente depois da rota estar aprovada;
6. encerra a rota assim que a Meta termina de processar o vídeo.

Enquanto não existe `containerId`, uma tentativa automática é segura: nada foi
enviado à Meta e não há risco de duplicação. Depois que existe um contêiner, o
AI Edita nunca cria outro automaticamente em resposta a uma situação incerta.

O cliente não precisa reagendar quando aparecer a mensagem de nova tentativa
automática. Se a conexão permanecer indisponível por mais de 15 minutos, o item
vai para revisão para evitar uma publicação muito atrasada.

## Acesso do aplicativo

- Para contas próprias ou contas adicionadas como teste no painel do aplicativo,
  a Meta normalmente permite Standard Access.
- Para vender o mesmo aplicativo a clientes externos, será necessário solicitar
  Advanced Access/App Review para as permissões usadas e disponibilizar os
  documentos exigidos pela Meta.

Isso não muda a experiência do cliente: ele continua usando Instagram Login,
sem Página do Facebook.

## Problemas comuns

- **A conta não valida:** confirme que é profissional, que o ID veio do fluxo
  Instagram Login e que o token não expirou.
- **Permissão de publicação ausente:** gere novamente o token com
  `instagram_business_content_publish`.
- **Vídeo recusado no pré-voo:** exporte novamente no perfil indicado pelo AI
  Edita. O app verifica MP4, H.264/HEVC, AAC, 48 kHz, FPS, bitrate, duração,
  tamanho e estrutura interna.
- **Tentativa automática de entrega:** mantenha o AI Edita aberto. Não crie outro
  agendamento; o aplicativo continuará sozinho antes de falar com a Meta.
- **Conferir no Instagram:** já existe um contêiner ou uma resposta de publicação
  incerta. Confira a conta antes de qualquer nova tentativa.
- **Horário perdido:** o computador estava desligado, suspenso ou sem internet
  por mais de 15 minutos.

## Referências oficiais

- [Instagram API — documentação oficial da Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Instagram API com Instagram Login](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login)
- [Requisitos de publicação de Reels](https://github.com/fbsamples/reels_publishing_apis/tree/main/insta_reels_publishing_api_sample)
