import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Assistente IA do MediaMind: conversa com o usuário para resolver qualquer
// tarefa no sistema. Entende o pedido, busca no perfil de trabalho do usuário,
// confirma se é aquilo (Sim/Não) e sugere a página/rota certa para executar.
// Recebe: { message, audioUrl, history, role, roleLabel, userName, destinations }.
// Retorna: { reply, rotas, confirmacao, transcription }.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const message = String(body.message || '');
    const audioUrl = String(body.audioUrl || '');
    const history = Array.isArray(body.history) ? body.history : [];
    const role = String(body.role || '');
    const roleLabel = String(body.roleLabel || role || '');
    const userName = String(body.userName || '');
    const destinations = Array.isArray(body.destinations) ? body.destinations : [];

    if (!message && !audioUrl) return Response.json({ error: 'Informe uma mensagem ou áudio' }, { status: 400 });

    let transcription = '';
    let finalMessage = message;
    if (audioUrl) {
      const t = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
      transcription = String(t?.transcript || t || '');
      finalMessage = (message ? message + ' ' : '') + '[Áudio transcrito]: ' + transcription;
    }

    const destList = destinations.map((d) => `- ${d.label} → ${d.path} (${d.desc || ''})`).join('\n');
    const histTxt = history.slice(-8).map((h) => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.content}`).join('\n');

    const sys = `Você é o Assistente IA do MediaMind AI (IAcervo Corp), em português do Brasil. Ajuda o usuário a resolver qualquer tarefa no sistema mais rápido, sem que ele se perca.

Perfil do usuário: ${roleLabel}${userName ? ` (${userName})` : ''}.

Seu trabalho:
1. Entender o que o usuário quer fazer.
2. Buscar no perfil dele o local certo (use a lista de destinos abaixo).
3. Se o pedido for ambíguo, confirme usando o campo "confirmacao" (pergunta de Sim/Não) antes de direcionar.
4. Sugerir de 1 a 3 "rotas" (páginas) relevantes com um motivo curto. O usuário aprova clicando.
5. Quando direcionar, explique em "reply" o que ele encontrará e o que fazer lá.
6. Seja curto, prático e direto. Não invente destinos que não estejam na lista.

Destinos disponíveis (label → caminho, descrição):
${destList}

Devolva JSON no schema informado: { reply: texto curto para o usuário, rotas: [{path,label,motivo}], confirmacao: pergunta Sim/Não ou null }.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: sys + (histTxt ? '\n\nHistórico:\n' + histTxt : '') + '\n\nPedido do usuário:\n' + (finalMessage || '(áudio)'),
      response_json_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          rotas: {
            type: 'array',
            items: {
              type: 'object',
              properties: { path: { type: 'string' }, label: { type: 'string' }, motivo: { type: 'string' } },
              required: ['path', 'label'],
            },
          },
          confirmacao: { type: 'string' },
        },
        required: ['reply'],
      },
    });

    const r = llm && typeof llm === 'object' ? llm : {};
    const rotas = Array.isArray(r.rotas) ? r.rotas.map((x) => ({ path: String(x.path || ''), label: String(x.label || ''), motivo: String(x.motivo || '') })).filter((x) => x.path) : [];

    return Response.json({
      reply: String(r.reply || ''),
      rotas,
      confirmacao: r.confirmacao ? String(r.confirmacao) : null,
      transcription,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}