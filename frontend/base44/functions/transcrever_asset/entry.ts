import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Transcreve o áudio de um asset via Whisper (Core.TranscribeAudio),
// divide em segmentos com timecode estimado e persiste em TranscricaoSegmento.
// Cria/atualiza um ProcessamentoJob e registra em LogAuditoria.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const assetId = String(body.asset_id || '');
    const assetTitle = String(body.asset_title || '');
    const audioUrl = String(body.audio_url || '');
    const durationSeconds = Number(body.duration_seconds || 0);
    const empresaId = String(body.empresa_id || '');

    if (!assetId || !audioUrl) {
      return Response.json({ error: 'asset_id e audio_url são obrigatórios' }, { status: 400 });
    }

    const job = await base44.entities.ProcessamentoJob.create({
      titulo: `Transcrição — ${assetTitle || 'asset ' + assetId}`,
      modulo: 'transcricao',
      status: 'processing',
      progresso: 10,
      erro: '',
      tentativas: 0,
      asset_title: assetTitle,
    });

    try {
      await base44.entities.ProcessamentoJob.update(job.id, { progresso: 30 });

      const result = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
      const transcript = String(result?.transcript || result || '');

      await base44.entities.ProcessamentoJob.update(job.id, { progresso: 70 });

      const totalMs = Math.max(durationSeconds * 1000, 1000);
      const words = transcript.split(/\s+/).filter(Boolean);
      const segLen = 12;
      const segments = [];
      const totalSegs = Math.max(1, Math.ceil(words.length / segLen));
      for (let i = 0; i < words.length; i += segLen) {
        const chunk = words.slice(i, i + segLen).join(' ');
        const idx = i / segLen;
        // Core.TranscribeAudio não retorna timestamps por palavra/segmento:
        // a distribuição é proporcional à duração -> timing ESTIMADO (não exato).
        // Marcamos explicitamente para a UI nunca apresentar isso como timecode real.
        segments.push({
          empresa_id: empresaId,
          asset_id: assetId,
          start_ms: Math.round((idx / totalSegs) * totalMs),
          end_ms: Math.round(((idx + 1) / totalSegs) * totalMs),
          texto: chunk,
          source: 'whisper',
          model: 'whisper-large',
          confidence: 0.9,
          verified: false,
          timing_quality: 'estimated',
        });
      }

      if (segments.length > 0) {
        await base44.entities.TranscricaoSegmento.bulkCreate(segments);
      }

      await base44.entities.ProcessamentoJob.update(job.id, { status: 'completed', progresso: 100 });

      await base44.entities.LogAuditoria.create({
        acao: 'Transcrição',
        entidade: 'Asset',
        detalhe: `${segments.length} segmentos gerados para "${assetTitle}" (asset ${assetId})`,
        ator: user.email || String(user.id),
      });

      return Response.json({ status: 'ok', segments: segments.length, job_id: job.id });
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