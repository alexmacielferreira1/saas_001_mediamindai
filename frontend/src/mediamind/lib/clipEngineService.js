import { base44 } from '@/api/base44Client';

// ============================================================================
// clipEngineService — camada única de orquestração do MediaMind AI Clip Engine.
// Centraliza acesso a Asset / TranscricaoSegmento / ClipCandidate / Clip e a
// invocação dos backends (transcrever_asset, analisar_cliples_ia). A UI não
// sabe qual modelo de IA está por trás — só chama estes métodos. Trocar o
// provedor no backend não exige mudar a UI.
//
// Princípios: edição não destrutiva (Clip = source_asset_id + IN/OUT + decisões),
// processa uma vez e reutiliza (transcrição/análise persistidas), degradação
// graciosa (sem Media Processor, clips virtuais + SRT/XML continuam funcionando).
// ============================================================================

export async function listAssets(query = {}) {
  const items = await base44.entities.Asset.filter(query, '-created_date', 200);
  return items;
}

export async function getAsset(assetId) {
  return base44.entities.Asset.get(assetId);
}

// Garante transcrição do asset: se já existem segmentos, reutiliza ("uma vez,
// reutiliza para sempre"). Senão invoca o backend transcrever_asset.
export async function ensureTranscription(asset, { empresaId = '', durationSeconds = 0 } = {}) {
  const existing = await base44.entities.TranscricaoSegmento.filter({ asset_id: String(asset.id) }, 'start_ms', 500);
  if (existing.length > 0) return { segments: existing, reused: true };
  const audioUrl = asset.stream_url || asset.source_url || asset.path || '';
  if (!audioUrl) {
    throw new Error('Asset sem mídia (path) para transcrever. Anexe um arquivo de áudio/vídeo ao asset no Acervo.');
  }
  const res = await base44.functions.invoke('transcrever_asset', {
    asset_id: String(asset.id),
    asset_title: asset.title || asset.filename || '',
    audio_url: audioUrl,
    duration_seconds: durationSeconds || (asset.duration ? asset.duration / 1000 : 0),
    empresa_id: empresaId,
  });
  const segments = await base44.entities.TranscricaoSegmento.filter({ asset_id: String(asset.id) }, 'start_ms', 500);
  return { segments, reused: false, jobId: res?.data?.job_id };
}

// Lista candidatos já persistidos para um asset (reutiliza análise anterior).
export async function listCandidates(assetId) {
  return base44.entities.ClipCandidate.filter({ asset_id: String(assetId) }, '-overall_score', 100);
}

// Executa análise IA real (backend analisar_clipes_ia). Não usa Math.random.
export async function runAnalysis({ asset, segments, prompt, purpose, durationLabel, aspectRatio, scoreProfile, interval, empresaId }) {
  const res = await base44.functions.invoke('analisar_clipes_ia', {
    asset_id: String(asset.id),
    asset_title: asset.title || asset.filename || '',
    segments: segments.map((s) => ({ start_ms: s.start_ms, end_ms: s.end_ms, texto: s.texto, speaker_label: s.speaker_label })),
    interval_start_ms: interval?.start_ms || 0,
    interval_end_ms: interval?.end_ms || 0,
    prompt, purpose, duration_label: durationLabel, aspect_ratio: aspectRatio,
    score_profile: scoreProfile, empresa_id: empresaId,
  });
  return res?.data?.candidates || [];
}

export async function updateCandidate(id, patch) {
  return base44.entities.ClipCandidate.update(id, patch);
}

// Promove candidato a Clip persistente (edição não destrutiva).
export async function promoteCandidate(candidate, asset, { empresaId = '', aspectRatio = '9:16', purpose = 'social' } = {}) {
  const clip = await base44.entities.Clip.create({
    empresa_id: empresaId,
    title: candidate.title || 'Novo corte',
    description: candidate.summary || '',
    status: 'draft',
    source_asset_id: String(asset.id),
    source_url: asset.stream_url || asset.source_url || asset.path || '',
    in_ms: candidate.start_ms,
    out_ms: candidate.end_ms,
    duration: candidate.end_ms - candidate.start_ms,
    suggested_in_ms: candidate.suggested_in_ms || 0,
    suggested_out_ms: candidate.suggested_out_ms || 0,
    prompt: candidate.prompt || '',
    purpose: candidate.purpose || purpose,
    aspect_ratio: aspectRatio,
    stage: 'ia',
    overall_score: candidate.overall_score || 0,
    hook_score: candidate.hook_score || 0, hook_grade: candidate.hook_grade || '', hook_explanation: candidate.hook_explanation || '',
    flow_score: candidate.flow_score || 0, flow_grade: candidate.flow_grade || '', flow_explanation: candidate.flow_explanation || '',
    value_score: candidate.value_score || 0, value_grade: candidate.value_grade || '', value_explanation: candidate.value_explanation || '',
    trend_score: candidate.trend_score || 0, trend_grade: candidate.trend_grade || '', trend_explanation: candidate.trend_explanation || '',
    relevance_score: candidate.relevance_score || 0,
    autonomy_score: candidate.autonomy_score || 0,
    editorial_score: candidate.editorial_score || 0,
    ai_reason: candidate.reason || '',
    keywords: candidate.keywords || '',
    favorite: !!candidate.favorite,
    selected: true,
    program_name: asset.program_name || '',
  });
  if (candidate.id) {
    await base44.entities.ClipCandidate.update(candidate.id, { selected: true, promoted_clip_id: clip.id });
  }
  return clip;
}

export async function listClips(empresaId = '') {
  const q = empresaId ? { empresa_id: empresaId } : {};
  return base44.entities.Clip.filter(q, '-created_date', 100);
}

export async function saveClip(clip) {
  if (clip.id) return base44.entities.Clip.update(clip.id, clip);
  return base44.entities.Clip.create(clip);
}

export async function updateClip(id, patch) {
  return base44.entities.Clip.update(id, patch);
}

// ============================================================================
// Versionamento — cada reimportação cria uma ClipVersion derivada do Clip pai
// (edição não destrutiva). Apenas uma versão é "atual" por clip.
// ============================================================================

export async function listVersions(clipId) {
  if (!clipId) return [];
  return base44.entities.ClipVersion.filter({ clip_id: String(clipId) }, '-created_date', 50);
}

export async function createVersion(clipId, { edited_url, version_label, notes, empresaId, authorName }) {
  const versions = await listVersions(clipId);
  const label = version_label || `v${versions.length + 1}`;
  const ver = await base44.entities.ClipVersion.create({
    empresa_id: empresaId || '',
    clip_id: String(clipId),
    version_label: label,
    edited_url: edited_url || '',
    status: 'draft',
    is_current: true,
    notes: notes || '',
    created_by_name: authorName || '',
  });
  // Marca as anteriores como não-atuais em lote.
  await base44.entities.ClipVersion.updateMany(
    { clip_id: String(clipId), id: { $ne: ver.id }, is_current: true },
    { $set: { is_current: false } }
  );
  await base44.entities.Clip.update(String(clipId), { current_version_id: ver.id, edited_url: edited_url || '' });
  return ver;
}

export async function setCurrentVersion(clipId, versionId) {
  const ver = await base44.entities.ClipVersion.get(String(versionId));
  if (!ver || ver.clip_id !== String(clipId)) throw new Error('Versão não pertence a este clip');
  await base44.entities.ClipVersion.updateMany(
    { clip_id: String(clipId), is_current: true },
    { $set: { is_current: false } }
  );
  await base44.entities.ClipVersion.update(String(versionId), { is_current: true });
  await base44.entities.Clip.update(String(clipId), { current_version_id: versionId, edited_url: ver.edited_url || '' });
  return ver;
}
