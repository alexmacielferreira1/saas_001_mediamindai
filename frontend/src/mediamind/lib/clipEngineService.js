import { base44 } from '@/api/base44Client';
import { transcribeMediaAsset } from '../../api/media';
import { startClipAnalysis } from '../../api/clips';
import { readLocalDemoSession } from './demoAccess';

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
// reutiliza para sempre"). Senão o servidor transcreve com o Whisper local
// (POST /media/assets/{id}/transcription) e grava os segmentos.
export async function ensureTranscription(asset) {
  const existing = await base44.entities.TranscricaoSegmento.filter({ asset_id: String(asset.id) }, 'start_ms', 500);
  if (existing.length > 0) return { segments: existing, reused: true };
  if (readLocalDemoSession()) throw new Error('A transcrição precisa do servidor: entre com uma conta real (o modo demonstração não transcreve).');
  await transcribeMediaAsset(asset.media_asset_id || asset.id);
  const segments = await base44.entities.TranscricaoSegmento.filter({ asset_id: String(asset.id) }, 'start_ms', 500);
  return { segments, reused: false };
}

// Lista candidatos já persistidos para um asset (reutiliza análise anterior).
export async function listCandidates(assetId) {
  return base44.entities.ClipCandidate.filter({ asset_id: String(assetId) }, '-overall_score', 100);
}

// Faixas de duração do Novo corte → mínimo/máximo aceitos pela análise (15 a 60 s no servidor).
export const DURATION_RANGES = {
  auto: [15, 60], '<30s': [15, 30], '30-60s': [30, 60], '60-90s': [45, 60], '90s-3min': [45, 60],
};

// Análise IA real (POST /clips/analyses): reaproveita a transcrição salva do asset e usa a IA
// escolhida para Cortes automáticos. Devolve os candidatos do servidor; nada é inventado aqui.
export async function runAnalysis({ asset, prompt = '', purpose = '', durationLabel = 'auto' }) {
  const [minimum, maximum] = DURATION_RANGES[durationLabel] || DURATION_RANGES.auto;
  const editorial = [prompt, purpose ? `Finalidade: ${purpose}` : ''].filter(Boolean).join('\n').slice(0, 2000);
  const result = await startClipAnalysis(asset.media_asset_id || asset.id, null, { minimum, maximum, editorial_prompt: editorial });
  if (result?.status !== 'completed') throw new Error(result?.message || 'A análise não terminou.');
  return result.candidates || [];
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
    ...(asset.fps ? { source_fps: asset.fps } : {}),
    ...(asset.width ? { source_width: asset.width } : {}),
    ...(asset.height ? { source_height: asset.height } : {}),
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
