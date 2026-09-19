import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const segment = String(body.segment || 'segmento');
    const prompt = body.prompt ? String(body.prompt) : '';
    const audioUrl = body.audio_url ? String(body.audio_url) : '';
    const pendencias = Array.isArray(body.pendencias) ? body.pendencias : [];

    if (!prompt && !audioUrl) {
      return Response.json({ error: 'Forneça um prompt de texto ou grave um áudio.' }, { status: 400 });
    }
    if (pendencias.length === 0) {
      return Response.json({ error: 'Nenhuma pendência enviada.' }, { status: 400 });
    }

    let instrucao = prompt;
    let transcricao = null;
    if (audioUrl) {
      const tr = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
      transcricao = (tr && (tr.transcript || tr.text)) || '';
      instrucao = transcricao || prompt;
    }

    const lista = pendencias.map((p: any, i: number) => ({
      id: p.id ?? String(i),
      titulo: p.titulo ?? '(sem título)',
      status: p.status ?? 'pendente',
      contexto: p.contexto ?? '',
    }));

    const systemPrompt =
      `Você é um assistente de comunicação corporativa do segmento "${segment}". ` +
      `O usuário pediu: "${instrucao}". ` +
      `Abaixo estão as pendências atuais. Para cada uma que puder ser resolvida ou avançada conforme o pedido, ` +
      `proponha uma ação concreta, o novo status e uma justificativa curta. ` +
      `Statuses válidos: "pendente", "em_andamento", "concluido". ` +
      `Pendências:\n` +
      lista.map((p) => `- [${p.id}] ${p.titulo} (status: ${p.status}) — ${p.contexto}`).join('\n') +
      `\n\nResponda em JSON no formato { "sugestoes": [ { "pendencia_id": "<id>", "acao": "...", "novo_status": "...", "justificativa": "..." } ] }. ` +
      `Só sugira para pendências que fazem sentido frente ao pedido. Não invente ids.`;

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: systemPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          sugestoes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pendencia_id: { type: 'string' },
                acao: { type: 'string' },
                novo_status: { type: 'string' },
                justificativa: { type: 'string' },
              },
              required: ['pendencia_id', 'acao', 'novo_status'],
            },
          },
        },
        required: ['sugestoes'],
      },
    });

    const sugestoes = Array.isArray((llm as any)?.sugestoes) ? (llm as any).sugestoes : [];
    return Response.json({ sugestoes, transcricao });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}