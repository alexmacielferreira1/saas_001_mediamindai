import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// MediaMind AI Clip Engine — descoberta de melhores cortes.
// Recebe: asset_id, segmentos de transcrição (com timestamps), intervalo,
// prompt editorial, finalidade, duração desejada e perfil de score.
// Usa Core.InvokeLLM (camada única de IA) com response_json_schema para obter
// candidatos estruturados e explicáveis. Persiste ClipCandidate + ProcessamentoJob
// + LogAuditoria. Não usa Math.random — todo score vem do LLM.
//
// Princípio: o LLM recebe blocos [start_ms] [end_ms] texto e devolve candidatos
// com score 0-100 por dimensão (Hook/Fluxo/Valor/Trend + Relevância/Autonomia/
// Editorial) e nota A+..C, com explicação textual de cada dimensão.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const assetId = String(body.asset_id || '');
    const assetTitle = String(body.asset_title || '');
    const segments = Array.isArray(body.segments) ? body.segments : [];
    const intervalStart = Number(body.interval_start_ms || 0);
    const intervalEnd = Number(body.interval_end_ms || 0);
    const prompt = String(body.prompt || '');
    const purpose = String(body.purpose || 'social');
    const durationLabel = String(body.duration_label || 'auto');
    const aspectRatio = String(body.aspect_ratio || '9:16');
    const scoreProfile = String(body.score_profile || 'social');
    const empresaId = String(body.empresa_id || '');

    if (!assetId || segments.length === 0) {
      return Response.json({ error: 'asset_id e segments são obrigatórios' }, { status: 400 });
    }

    const job = await base44.entities.ProcessamentoJob.create({
      titulo: `Análise IA — ${assetTitle || 'asset ' + assetId}`,
      modulo: 'ia',
      status: 'processing',
      progresso: 10,
      erro: '',
      tentativas: 0,
      asset_title: assetTitle,
    });

    try {
      // Filtra segmentos ao intervalo solicitado e monta blocos com timestamp.
      const inSegs = segments.filter((s) => {
        const sStart = Number(s.start_ms || 0);
        const sEnd = Number(s.end_ms || 0);
        if (intervalEnd > 0 && sStart > intervalEnd) return false;
        if (intervalStart > 0 && sEnd < intervalStart) return false;
        return true;
      }).slice(0, 220);

      const blocks = inSegs.map((s) => {
        const sp = s.speaker_label ? `[${s.speaker_label}] ` : '';
        return `[${Math.round(Number(s.start_ms || 0))}] [${Math.round(Number(s.end_ms || 0))}] ${sp}${String(s.texto || '').trim()}`;
      }).join('\n');

      const profileText = {
        social: 'Priorize gancho forte, retenção, emoção, tendência e autonomia do trecho.',
        editorial: 'Priorize relevância, clareza, contexto, completude e fonte confiável.',
        documental: 'Priorize raridade, contexto, valor histórico e riqueza de metadados.',
      }[scoreProfile] || 'Equilíbrio entre gancho e valor informativo.';

      const systemPrompt = `Você é o motor de descoberta de cortes do MediaMind AI (estilo OpusClip, mas para TV/jornalismo).
Analise a transcrição COM TIMESTAMPS abaixo e selecione os melhores trechos para virarem cortes curtos.
Cada trecho deve ser autônomo (não começar no meio de um raciocínio nem terminar antes da conclusão), respeitar a duração alvo e o prompt editorial do usuário.
Para cada candidato, devolva score 0-100 por dimensão e uma nota (A+, A, A-, B+, B, B-, C+, C, C-) com explicação curta e específica baseada no conteúdo real — nunca genérica.
${profileText}
Finalidade: ${purpose}. Duração alvo: ${durationLabel}. Formato: ${aspectRatio}.
${prompt ? `Prompt do usuário: "${prompt}"` : 'Sem prompt específico — encontre os momentos mais fortes.'}
Devolva de 3 a 6 candidatos, ordenados por overall_score decrescente. Não invente trechos fora do intervalo da transcrição.`;

      const userPrompt = `TRANSCRIÇÃO (ms):\n${blocks}\n\nDevolva JSON com candidates[].`;

      await base44.entities.ProcessamentoJob.update(job.id, { progresso: 30 });

      const schema = {
        type: 'object',
        properties: {
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start_ms: { type: 'number' },
                end_ms: { type: 'number' },
                title: { type: 'string' },
                summary: { type: 'string' },
                reason: { type: 'string' },
                overall_score: { type: 'number' },
                hook_score: { type: 'number' }, hook_grade: { type: 'string' }, hook_explanation: { type: 'string' },
                flow_score: { type: 'number' }, flow_grade: { type: 'string' }, flow_explanation: { type: 'string' },
                value_score: { type: 'number' }, value_grade: { type: 'string' }, value_explanation: { type: 'string' },
                trend_score: { type: 'number' }, trend_grade: { type: 'string' }, trend_explanation: { type: 'string' },
                relevance_score: { type: 'number' },
                autonomy_score: { type: 'number' },
                editorial_score: { type: 'number' },
                keywords: { type: 'array', items: { type: 'string' } },
                suggested_platforms: { type: 'array', items: { type: 'string' } },
                suggested_in_ms: { type: 'number' },
                suggested_out_ms: { type: 'number' },
              },
              required: ['start_ms', 'end_ms', 'title', 'overall_score'],
            },
          },
        },
        required: ['candidates'],
      };

      const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        response_json_schema: schema,
      });

      const candidates = Array.isArray(llmRes?.candidates) ? llmRes.candidates : [];

      // Clampa ao intervalo e descarta candidatos inválidos.
      const lo = intervalStart || 0;
      const hi = intervalEnd > 0 ? intervalEnd : (inSegs.length ? Number(inSegs[inSegs.length - 1].end_ms || 0) : 0);
      const clean = candidates
        .map((c, i) => {
          let st = Math.round(Number(c.start_ms || 0));
          let en = Math.round(Number(c.end_ms || 0));
          if (hi > 0) { st = Math.min(st, hi); en = Math.min(en, hi); }
          st = Math.max(st, lo);
          if (en <= st) en = st + 5000;
          return {
            ...c,
            start_ms: st,
            end_ms: en,
            duration: en - st,
            rank: i + 1,
            keywords: Array.isArray(c.keywords) ? c.keywords.join(', ') : '',
            suggested_platforms: Array.isArray(c.suggested_platforms) ? c.suggested_platforms.join(', ') : '',
          };
        })
        .filter((c) => c.end_ms > c.start_ms)
        .sort((a, b) => Number(b.overall_score || 0) - Number(a.overall_score || 0))
        .map((c, i) => ({ ...c, rank: i + 1 }));

      await base44.entities.ProcessamentoJob.update(job.id, { progresso: 80 });

      // Persiste candidatos (reutiliza processamento — "uma vez, reutiliza para sempre").
      if (clean.length > 0) {
        const records = clean.map((c) => ({
          empresa_id: empresaId,
          asset_id: assetId,
          processing_job_id: job.id,
          start_ms: c.start_ms,
          end_ms: c.end_ms,
          duration: c.duration,
          title: String(c.title || 'Candidato'),
          summary: String(c.summary || ''),
          reason: String(c.reason || ''),
          overall_score: Number(c.overall_score || 0),
          hook_score: Number(c.hook_score || 0), hook_grade: String(c.hook_grade || ''), hook_explanation: String(c.hook_explanation || ''),
          flow_score: Number(c.flow_score || 0), flow_grade: String(c.flow_grade || ''), flow_explanation: String(c.flow_explanation || ''),
          value_score: Number(c.value_score || 0), value_grade: String(c.value_grade || ''), value_explanation: String(c.value_explanation || ''),
          trend_score: Number(c.trend_score || 0), trend_grade: String(c.trend_grade || ''), trend_explanation: String(c.trend_explanation || ''),
          relevance_score: Number(c.relevance_score || 0),
          autonomy_score: Number(c.autonomy_score || 0),
          editorial_score: Number(c.editorial_score || 0),
          keywords: c.keywords,
          suggested_platforms: c.suggested_platforms,
          suggested_in_ms: Number(c.suggested_in_ms || 0),
          suggested_out_ms: Number(c.suggested_out_ms || 0),
          prompt, purpose, rank: c.rank,
          selected: false, favorite: false, rejected: false,
        }));
        await base44.entities.ClipCandidate.bulkCreate(records);
      }

      await base44.entities.ProcessamentoJob.update(job.id, { status: 'completed', progresso: 100 });

      await base44.entities.LogAuditoria.create({
        acao: 'Análise IA de cortes',
        entidade: 'Asset',
        detalhe: `${clean.length} candidatos gerados para "${assetTitle}" (asset ${assetId}) — perfil ${scoreProfile}`,
        ator: user.email || String(user.id),
      });

      return Response.json({ status: 'ok', candidates: clean, job_id: job.id });
    } catch (inner) {
      await base44.entities.ProcessamentoJob.update(job.id, {
        status: 'failed',
        erro: String(inner.message || inner),
        tentativas: 1,
      });
      return Response.json({ error: String(inner.message || inner), job_id: job.id }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}