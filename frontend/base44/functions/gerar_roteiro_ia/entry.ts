import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Gera roteiro (blocos de texto) e ajustes de edição a partir de um prompt de
// texto e/ou áudio (transcrito via Whisper). Retorna { blocos, ajustes,
// transcription }. Disponível para qualquer usuário autenticado.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const prompt = String(body.prompt || '');
    const audioUrl = String(body.audioUrl || '');
    const projectTitle = String(body.projectTitle || '');
    const program = String(body.program || '');
    const segment = String(body.segment || '');

    if (!prompt && !audioUrl) return Response.json({ error: 'Informe um prompt ou um áudio' }, { status: 400 });

    let transcription = '';
    let finalPrompt = prompt;
    if (audioUrl) {
      const t = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
      transcription = String(t?.transcript || t || '');
      finalPrompt = (prompt ? prompt + '\n\n' : '') + '[Áudio transcrito]: ' + transcription;
    }

    const ctx = [projectTitle && `Projeto: ${projectTitle}`, program && `Programa: ${program}`, segment && `Segmento: ${segment}`].filter(Boolean).join('\n');

    const sys = `Você é o roteirista e editor do MediaMind AI (IAcervo Corp). Gere conteúdo de roteiro de TV/vídeo e ajustes de edição a partir do pedido do usuário, em português do Brasil.

${ctx ? 'Contexto:\n' + ctx + '\n' : ''}
Devolva JSON no schema informado com:
- "blocos": lista de blocos de texto do roteiro (falas de apresentador/locutor, chamadas, passagens). Cada bloco: { content: texto, track: "t1" (texto) ou "v1"/"v2"/"a1" se for vídeo/áudio }.
- "ajustes": lista de instruções de edição (cortes, transições, legendas, efeitos, correções de cor). Cada ajuste: { tipo, descricao, timecode } (timecode opcional, formato HH:MM:SS).

Regras:
- Mantenha um tom adequado ao programa/segmento informado.
- Se o pedido for só roteiro, devolva "ajustes" vazio; se for só edição, devolva "blocos" vazio.
- Textos prontos para locução, curtos e diretos.
- Devolva SOMENTE o JSON no schema informado.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: sys + '\n\nPedido:\n' + (finalPrompt || '(sem texto, apenas áudio)'),
      response_json_schema: {
        type: 'object',
        properties: {
          blocos: {
            type: 'array',
            items: {
              type: 'object',
              properties: { content: { type: 'string' }, track: { type: 'string' } },
              required: ['content'],
            },
          },
          ajustes: {
            type: 'array',
            items: {
              type: 'object',
              properties: { tipo: { type: 'string' }, descricao: { type: 'string' }, timecode: { type: 'string' } },
              required: ['descricao'],
            },
          },
        },
      },
    });

    const result = llm && typeof llm === 'object' ? llm : {};
    const blocos = Array.isArray(result.blocos) ? result.blocos.map((b) => ({ content: String(b.content || ''), track: String(b.track || 't1') })).filter((b) => b.content) : [];
    const ajustes = Array.isArray(result.ajustes) ? result.ajustes.map((a) => ({ tipo: String(a.tipo || ''), descricao: String(a.descricao || ''), timecode: String(a.timecode || '') })).filter((a) => a.descricao) : [];

    return Response.json({ blocos, ajustes, transcription });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}