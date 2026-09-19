import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Configura o acesso de um funcionário por IA: recebe um prompt de texto e/ou
// um áudio (transcrito via Whisper), e o LLM devolve { role, extraTabs,
// removedTabs } com base no catálogo de telas e cargos. Somente admin.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem configurar acessos por IA' }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body.userId || '');
    const userName = String(body.userName || '');
    const prompt = String(body.prompt || '');
    const audioUrl = String(body.audioUrl || '');
    const screens = Array.isArray(body.screens) ? body.screens : [];
    const cargos = Array.isArray(body.cargos) ? body.cargos : [];

    if (!userId) return Response.json({ error: 'userId é obrigatório' }, { status: 400 });
    if (!prompt && !audioUrl) return Response.json({ error: 'Informe um prompt ou um áudio' }, { status: 400 });

    let transcription = '';
    let finalPrompt = prompt;
    if (audioUrl) {
      const t = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
      transcription = String(t?.transcript || t || '');
      finalPrompt = (prompt ? prompt + '\n\n' : '') + '[Áudio transcrito]: ' + transcription;
    }

    const screensTxt = screens.map((s) => `- ${s.id}: ${s.name}`).join('\n');
    const cargosTxt = cargos.map((c) => `- ${c.id}: ${c.name}`).join('\n');

    const sys = `Você é o assistente de administração de acessos do IAcervo Corp. Configure o acesso de um funcionário com base no pedido do administrador.

Telas disponíveis (id: nome):
${screensTxt}

Cargos disponíveis (id: nome):
${cargosTxt}

Regras:
- Escolha exatamente UM cargo em "role" (use o id do cargo).
- "extraTabs" = telas adicionais além do padrão do cargo (ids de tela).
- "removedTabs" = telas do padrão do cargo que devem ser removidas (ids de tela).
- Use somente ids válidos listados acima.
- Se o pedido não menciona telas extras/removidas, devolva arrays vazios.
- Funcionário alvo: ${userName || userId}.

Devolva SOMENTE o JSON no schema informado.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: sys + '\n\nPedido do administrador:\n' + (finalPrompt || '(sem texto, apenas áudio)'),
      response_json_schema: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          extraTabs: { type: 'array', items: { type: 'string' } },
          removedTabs: { type: 'array', items: { type: 'string' } },
        },
        required: ['role'],
      },
    });

    const result = llm && typeof llm === 'object' ? llm : {};
    return Response.json({
      role: String(result.role || ''),
      extraTabs: Array.isArray(result.extraTabs) ? result.extraTabs.map(String) : [],
      removedTabs: Array.isArray(result.removedTabs) ? result.removedTabs.map(String) : [],
      transcription,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}