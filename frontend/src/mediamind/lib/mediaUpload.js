import { uploadMediaAsset } from '../../api/media';

export function uploadMvpMedia(file, metadata = {}) {
  return uploadMediaAsset(file, {
    origin: metadata.origin,
    project_id: metadata.projectId ?? metadata.project_id,
    recording_id: metadata.recordingId ?? metadata.recording_id,
  });
}
