import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendFormWithProgress } from './uploadProgress';
import { uploadMediaAssetWithProgress, isSupportedMediaFile } from './media';

class FakeXhr {
  static last;
  constructor() { this.upload = {}; this.headers = {}; FakeXhr.last = this; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(key, value) { this.headers[key] = value; }
  send(body) { this.body = body; }
  respond(status, payload) { this.status = status; this.responseText = payload === undefined ? '' : JSON.stringify(payload); this.onload(); }
}

describe('envio com progresso', () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('envia com credenciais, informa progresso e devolve o JSON', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const progress = vi.fn();
    const pending = sendFormWithProgress('/media/assets', new FormData(), { onProgress: progress });
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/v1/media/assets');
    expect(xhr.withCredentials).toBe(true);
    xhr.upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 });
    expect(progress).toHaveBeenCalledWith(25);
    xhr.respond(201, { id: 'a1' });
    await expect(pending).resolves.toEqual({ id: 'a1' });
  });

  it('erro do servidor vira ApiError com a mensagem pública', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const pending = sendFormWithProgress('/media/assets', new FormData());
    FakeXhr.last.respond(422, { error_code: 'INVALID_MEDIA_TYPE', message: 'Tipo de mídia não permitido.' });
    await expect(pending).rejects.toMatchObject({ name: 'ApiError', status: 422, code: 'INVALID_MEDIA_TYPE', message: 'Tipo de mídia não permitido.' });
  });

  it('413 sem corpo explica o limite; 401 avisa a sessão; rede cai com mensagem clara', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const tooBig = sendFormWithProgress('/uploads', new FormData());
    FakeXhr.last.respond(413);
    await expect(tooBig).rejects.toMatchObject({ status: 413, message: 'Arquivo maior que o limite permitido pelo servidor.' });

    const listener = vi.fn();
    window.addEventListener('mediamind:authentication-required', listener);
    const unauth = sendFormWithProgress('/uploads', new FormData());
    FakeXhr.last.respond(401, { error_code: 'AUTHENTICATION_REQUIRED', message: 'Entre novamente.' });
    await expect(unauth).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('mediamind:authentication-required', listener);

    const network = sendFormWithProgress('/uploads', new FormData());
    FakeXhr.last.onerror();
    await expect(network).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const aborted = sendFormWithProgress('/uploads', new FormData());
    FakeXhr.last.onabort();
    await expect(aborted).rejects.toMatchObject({ code: 'UPLOAD_ABORTED' });
  });

  it('upload de mídia usa a rota real /media/assets com o arquivo e a origem', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const file = new File(['v'], 'a.mp4', { type: 'video/mp4' });
    const pending = uploadMediaAssetWithProgress(file, { origin: 'ingest' });
    expect(FakeXhr.last.url).toBe('/api/v1/media/assets');
    expect(FakeXhr.last.body.get('file')).toBe(file);
    expect(FakeXhr.last.body.get('origin')).toBe('ingest');
    FakeXhr.last.respond(201, { id: 'm1' });
    await expect(pending).resolves.toEqual({ id: 'm1' });
  });

  it('reconhece os formatos aceitos pelo servidor de mídia', () => {
    expect(isSupportedMediaFile(new File([''], 'a.MP4', { type: 'video/mp4' }))).toBe(true);
    expect(isSupportedMediaFile(new File([''], 'a.mkv', { type: 'video/x-matroska' }))).toBe(false);
    expect(isSupportedMediaFile(new File([''], 'a.mp4', { type: '' }))).toBe(false);
    expect(isSupportedMediaFile(null)).toBe(false);
  });
});
