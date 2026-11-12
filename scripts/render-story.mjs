#!/usr/bin/env node
/**
 * Renderizador Determinístico de Motion Design (1080x1920 @ 60fps -> MP4)
 *
 * O que faz:
 * 1. Sobe (ou reutiliza) o servidor Angular em http://127.0.0.1:4200
 * 2. Abre /story?render=1 no Chromium Headless em 1080x1920 exatos
 * 3. Congela todas as animações da Web Animations API e avança `anim.currentTime = frame * (1000 / 60)`
 * 4. Envia cada frame JPEG (qualidade 98) via pipe direto para o FFmpeg (H.264 yuv420p, pronto para Instagram/WhatsApp)
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 60;
const DURATION_SEC = 15;
const TOTAL_FRAMES = FPS * DURATION_SEC; // 900 frames
const PORT = 4215;
const TARGET_URL = process.env.STORY_URL || `http://127.0.0.1:${PORT}/story?render=1`;
const OUTPUT_FILE = resolve(process.cwd(), process.argv[2] || 'dist/story-1080x1920-60fps.mp4');

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Aguardando servidor iniciar
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Servidor não respondeu em ${url} após ${timeoutMs}ms`);
}

async function main() {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });

  let devServer = null;
  if (!process.env.STORY_URL) {
    console.log(`▶ Iniciando servidor Angular na porta ${PORT}...`);
    devServer = spawn('npx', ['ng', 'serve', '--port', String(PORT), '--host', '127.0.0.1'], {
      stdio: 'ignore',
      detached: false,
    });
    await waitForServer(`http://127.0.0.1:${PORT}/story`);
  }

  console.log(`▶ Abrindo Chromium Headless (${WIDTH}x${HEIGHT} @ ${FPS}fps)...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    // Pausa todas as animações no frame 0 para controle determinístico quadro a quadro
    await page.evaluate(() => {
      for (const anim of document.getAnimations({ subtree: true })) {
        anim.pause();
        anim.currentTime = 0;
      }
    });

    console.log(`▶ Renderizando ${TOTAL_FRAMES} frames (${DURATION_SEC}s @ ${FPS}fps)...`);

    const ffmpeg = spawn(
      ffmpegPath,
      [
        '-y',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-framerate', String(FPS),
        '-i', '-',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'high',
        '-level', '4.2',
        '-crf', '17',
        '-preset', 'slow',
        '-movflags', '+faststart',
        OUTPUT_FILE,
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] }
    );

    let ffmpegStderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      ffmpegStderr += chunk.toString();
    });

    for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
      const timeMs = (frame / FPS) * 1000;

      await page.evaluate((t) => {
        for (const anim of document.getAnimations({ subtree: true })) {
          anim.pause();
          anim.currentTime = t;
        }
      }, timeMs);

      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 94,
        animations: 'allow',
        caret: 'hide',
      });

      const canContinue = ffmpeg.stdin.write(buffer);
      if (!canContinue) {
        await new Promise((r) => ffmpeg.stdin.once('drain', r));
      }

      if ((frame + 1) % 60 === 0 || frame === TOTAL_FRAMES - 1) {
        const pct = (((frame + 1) / TOTAL_FRAMES) * 100).toFixed(0);
        process.stdout.write(`\r  • Progresso: ${frame + 1}/${TOTAL_FRAMES} frames (${pct}%)`);
      }
    }

    process.stdout.write('\n');
    ffmpeg.stdin.end();

    await new Promise((resolvePromise, rejectPromise) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) resolvePromise();
        else rejectPromise(new Error(`FFmpeg falhou (code ${code}):\n${ffmpegStderr}`));
      });
    });

    console.log(`✔ Vídeo exportado com sucesso: ${OUTPUT_FILE}`);
  } finally {
    await browser.close();
    if (devServer) {
      devServer.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error('\n✖ Erro ao renderizar Story:', err.message);
  process.exit(1);
});
