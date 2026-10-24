import fs from 'node:fs';
import path from 'node:path';
import { RUN_DIR } from './fixtures.js';

/**
 * Gera no próprio Chrome um vídeo WebM curto (VP8/VP9 + Opus) com imagem animada e tom de
 * áudio (canvas.captureStream + WebAudio + MediaRecorder) e uma imagem PNG. Os arquivos ficam
 * na pasta da execução; nenhum conteúdo externo é usado.
 */
export async function generateFixtures(page, runId) {
  const dir = path.join(RUN_DIR, 'fixtures');
  const video = path.join(dir, `e2e-video-${runId}.webm`);
  const image = path.join(dir, `e2e-imagem-${runId}.png`);
  if (fs.existsSync(video) && fs.existsSync(image)) return { video, image, dir };
  fs.mkdirSync(dir, { recursive: true });
  await page.goto('about:blank');
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    osc.frequency.value = 440;
    const dest = audio.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    let frame = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${(frame * 6) % 360} 70% 45%)`;
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(`E2E ${frame}`, 20, 100);
      frame += 1;
    }, 33);
    recorder.start(250);
    await new Promise((r) => setTimeout(r, 3000));
    recorder.stop();
    await done;
    clearInterval(timer);
    osc.stop();
    const blob = new Blob(chunks, { type: 'video/webm' });
    const videoB64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(blob);
    });
    ctx.fillStyle = '#123456'; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#ffcc00'; ctx.fillText('E2E imagem', 20, 100);
    const imageB64 = canvas.toDataURL('image/png').split(',')[1];
    return { videoB64, imageB64, mime };
  });
  fs.writeFileSync(video, Buffer.from(result.videoB64, 'base64'));
  fs.writeFileSync(image, Buffer.from(result.imageB64, 'base64'));
  return { video, image, dir };
}
