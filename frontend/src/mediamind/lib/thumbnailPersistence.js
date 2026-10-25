import { mergePersistedProject } from './producaoStore';
import { base44 } from '@/api/base44Client';
import { uploadMediaAsset, resolveMediaUrl } from '@/api/media';

export async function listSavedThumbnails(projectId) {
  const records = await base44.entities.CreativeDocument.list('-created_date', 500);
  return records.filter((r) => r.tool_type === 'thumbnail' && (!projectId || String(r.project_id) === String(projectId)));
}

export async function persistThumbnailSession(session, projectId) {
  const copied = JSON.parse(JSON.stringify(session));
  const uploads = new Map();
  async function persistentUrl(url, name) {
    if (!url?.startsWith('blob:')) return url || '';
    if (!uploads.has(url)) uploads.set(url, (async () => {
      const response = await fetch(url); if (!response.ok) throw new Error('A foto temporária expirou. Envie-a novamente.');
      const blob = await response.blob(); const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      const asset = await uploadMediaAsset(new File([blob], `${name}.${extension}`, { type: blob.type || 'image/png' }), { origin: 'thumbnail-source', project_id: projectId });
      return { url: resolveMediaUrl(asset.stream_url), assetId: asset.id };
    })());
    return (await uploads.get(url)).url;
  }
  for (const p of copied.draft.people) for (const key of ['photo', 'originalPhoto', 'cutoutPhoto']) p[key] = await persistentUrl(p[key], `pessoa-${p.id}-${key}`);
  for (const p of copied.draft.photos) p.url = await persistentUrl(p.url, `foto-${p.id}`);
  copied.referenceUrl = await persistentUrl(copied.referenceUrl, 'referencia');
  copied.draft.channelLogo = await persistentUrl(copied.draft.channelLogo, 'logo-canal');
  copied.draft.programLogo = await persistentUrl(copied.draft.programLogo, 'logo-programa');
  copied.draft.projectId = String(projectId || '');
  return copied;
}

export async function saveThumbnailVersion(session, { exports = [] } = {}) {
  const projectId = session.draft.projectId;
  const content = await persistThumbnailSession(session, projectId);
  // Append a version; old saved compositions remain reusable and reversible.
  const record = await base44.entities.CreativeDocument.create({
    tool_type: 'thumbnail', project_id: projectId, project_entity: session.draft.projectEntity || 'ProducaoProjeto',
    title: session.draft.highlight || session.draft.title, program: session.draft.program,
    episode: session.draft.episode, status: 'draft', revision: (session.revision || 0) + 1,
    previous_version_id: session.savedId || null, source_document_id: session.sourceDocumentId || null,
    content: { ...content, expanded: true }, asset_ids: exports.map((e) => e.assetId), exports,
  });
  return { ...content, savedId: record.id, revision: record.revision };
}

export async function markProjectThumbnail(session, exports) {
  if (!session.draft.projectId || !session.savedId) throw new Error('Salve a thumb vinculada a um projeto primeiro.');
  const entity = session.draft.projectEntity || 'ProducaoProjeto';
  if (entity !== 'ProducaoProjeto') throw new Error('O tipo deste projeto não permite definir capa por este fluxo.');
  const changes = {
    thumbnail_document_id: session.savedId, thumbnail_assets: exports,
    thumbnail_url: exports.find((e) => e.format === 'horizontal')?.url || exports[0]?.url || '',
  };
  const saved = await base44.entities.ProducaoProjeto.update(session.draft.projectId, changes);
  // Guarda a versão nova para a próxima gravação da produção não acusar conflito falso.
  mergePersistedProject(session.draft.projectId, { ...changes, ...(saved?.updated_date ? { _updatedDate: saved.updated_date } : {}) });
}
