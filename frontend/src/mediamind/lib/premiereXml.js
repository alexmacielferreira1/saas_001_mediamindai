// Gera um XML Final Cut Pro 7 (xmeml) com os materiais do projeto como clipes.
// O Premiere Pro importa esse formato; ao abrir, pede pra reconectar os arquivos
// na pasta local onde o editor baixou as mídias. Assim o editor abre o projeto e
// conecta as mídias na pasta onde estão.

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function gerarXmlPremiere(projeto) {
  const materiais = projeto.materiais || [];
  const nomeProj = esc(projeto.titulo || 'Produção');
  const clipes = materiais.map((m, i) => {
    const fname = esc(m.nome || `clip_${i + 1}.mp4`);
    return `
    <clipitem id="clip-${i + 1}">
      <name>${fname}</name>
      <enabled>TRUE</enabled>
      <duration>3600</duration>
      <rate><timebase>25</timebase></rate>
      <start>0</start>
      <end>3600</end>
      <in>0</in>
      <out>3600</out>
      <file id="file-${i + 1}">
        <name>${fname}</name>
        <pathurl>file://localhost/${fname}</pathurl>
        <rate><timebase>25</timebase></rate>
        <duration>3600</duration>
        <timecode><rate><timebase>25</timebase></rate><string>00:00:00:00</string><frame>0</frame></timecode>
        <media>
          <video><samplecharacteristics><rate><timebase>25</timebase></rate><width>1920</width><height>1080</height></samplecharacteristics></video>
          <audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics></audio>
        </media>
      </file>
    </clipitem>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="seq-1">
    <name>${nomeProj}</name>
    <rate><timebase>25</timebase></rate>
    <media>
      <video>
        <format><samplecharacteristics><rate><timebase>25</timebase></rate><width>1920</width><height>1080</height></samplecharacteristics></format>
        <track>${clipes}
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;
}

export function baixarXmlPremiere(projeto) {
  const xml = gerarXmlPremiere(projeto);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(projeto.titulo || 'producao').replace(/[^a-z0-9-_]+/gi, '_')}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Exportação REAL de um corte (Clip Engine) — edição não destrutiva.
// Gera XML Final Cut Pro 7 (xmeml) com IN/OUT reais do master e SRT das
// legendas. O editor baixa, abre no Premiere (reconecta a mídia) e devolve a
// versão editada via reimport. Sem Media Processor externo, o artifact é
// fiel às decisões tomadas no workspace (IN/OUT, legendas, CGs).
// ============================================================================

const FPS = 25;
const ms2f = (ms) => Math.round((Number(ms) || 0) / 1000 * FPS);
function f2tc(f) {
  f = Math.max(0, Math.round(f));
  const h = Math.floor(f / (FPS * 3600));
  const m = Math.floor((f % (FPS * 3600)) / (FPS * 60));
  const s = Math.floor((f % (FPS * 60)) / FPS);
  const fr = f % FPS;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
}

function fileNameFromUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const p = u.pathname.split('/').filter(Boolean).pop();
    return p ? decodeURIComponent(p) : 'master.mp4';
  } catch {
    return String(url || 'master.mp4').split('/').pop() || 'master.mp4';
  }
}

// XML Premiere para um único corte: master com IN/OUT + faixa de legendas como
// títulos. Não destrutivo — referencia o arquivo master, não embute mídia.
export function gerarXmlPremiereClip(clip, { legendas = [], cgs = [] } = {}) {
  const inF = ms2f(clip.in_ms || 0);
  const outF = ms2f(clip.out_ms || (clip.in_ms || 0) + 60000);
  const durF = Math.max(1, outF - inF);
  const masterName = esc(fileNameFromUrl(clip.source_url) || 'master.mp4');
  const pathurl = esc(clip.source_url || `file://localhost/${masterName}`);
  const title = esc(clip.titulo || clip.title || 'Corte');

  // CGs como títulos sobrepostos (faixa de vídeo 2), relativos ao início do corte.
  const cgItems = (cgs || []).map((c, i) => {
    const cIn = Math.max(0, ms2f(c.start_ms) - inF);
    const cOut = Math.min(durF, ms2f(c.end_ms) - inF);
    if (cOut <= cIn) return '';
    return `
        <clipitem id="cg-${i + 1}">
          <name>${esc(c.titulo || 'CG')}</name>
          <enabled>TRUE</enabled>
          <duration>${cOut - cIn}</duration>
          <rate><timebase>${FPS}</timebase></rate>
          <start>${cIn}</start>
          <end>${cOut}</end>
          <in>${cIn}</in>
          <out>${cOut}</out>
          <generatoritem><generatorinfo><appname>Title</appname></generatoritem></generatoritem>
        </clipitem>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="seq-clip">
    <name>${title}</name>
    <rate><timebase>${FPS}</timebase></rate>
    <media>
      <video>
        <format><samplecharacteristics><rate><timebase>${FPS}</timebase></rate><width>1920</width><height>1080</height></samplecharacteristics></format>
        <track>
          <clipitem id="clip-master">
            <name>${masterName}</name>
            <enabled>TRUE</enabled>
            <duration>${outF}</duration>
            <rate><timebase>${FPS}</timebase></rate>
            <start>0</start>
            <end>${durF}</end>
            <in>${inF}</in>
            <out>${outF}</out>
            <file id="file-master">
              <name>${masterName}</name>
              <pathurl>${pathurl}</pathurl>
              <rate><timebase>${FPS}</timebase></rate>
              <duration>${outF}</duration>
              <timecode><rate><timebase>${FPS}</timebase></rate><string>${f2tc(inF)}</string><frame>${inF}</frame></timecode>
              <media>
                <video><samplecharacteristics><rate><timebase>${FPS}</timebase></rate><width>1920</width><height>1080</height></samplecharacteristics></video>
                <audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics></audio>
              </media>
            </file>
          </clipitem>
        </track>
        <track>${cgItems}
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;
}

// SRT das legendas, com tempos relativos ao início do corte (0 = IN).
export function gerarSrtClip(clip, legendas = []) {
  const base = Number(clip.in_ms || 0);
  const lines = (legendas || []).filter((l) => l.texto && l.texto.trim());
  return lines.map((l, i) => {
    const s = Math.max(0, Number(l.start_ms || 0) - base);
    const e = Math.max(s, Number(l.end_ms || 0) - base);
    return `${i + 1}\n${srtTime(s)} --> ${srtTime(e)}\n${String(l.texto).trim()}`;
  }).join('\n\n');
}

function srtTime(ms) {
  ms = Math.max(0, Math.round(ms));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mm).padStart(3, '0')}`;
}

export function baixarTexto(nome, conteudo, mime = 'text/plain') {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function baixarXmlPremiereClip(clip, opts) {
  baixarTexto(`${(clip.titulo || clip.title || 'corte').replace(/[^a-z0-9-_]+/gi, '_')}.xml`, gerarXmlPremiereClip(clip, opts), 'application/xml');
}

export function baixarSrtClip(clip, legendas) {
  baixarTexto(`${(clip.titulo || clip.title || 'corte').replace(/[^a-z0-9-_]+/gi, '_')}.srt`, gerarSrtClip(clip, legendas), 'text/plain');
}