// Renders the film frame by frame.
//
//   node render.mjs --out film.mp4 [--scale 2] [--audio track.wav]
//   node render.mjs --stills 0,5.5,12 --outdir shots/
//   node render.mjs --events events.json
//
// Needs playwright-core and a static ffmpeg with x264 (FFMPEG env var).
// PLAYWRIGHT_CORE may point at playwright-core's index.mjs when it is not
// installed next to this file.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

const FPS = 30;
const scale = Number(args.scale || 1);
const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.evaluate(() => window.ready);
const dur = await page.evaluate(() => window.DUR);

if (args.events) {
  writeFileSync(args.events, JSON.stringify(await page.evaluate(() => window.EVENTS), null, 1));
  console.log('events written');
}

if (args.stills) {
  const dir = args.outdir || join(here, 'stills');
  mkdirSync(dir, { recursive: true });
  for (const s of String(args.stills).split(',')) {
    const t = Number(s);
    await page.evaluate((t) => window.renderAt(t), t);
    await page.screenshot({ path: join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`) });
  }
  console.log('stills written to', dir);
}

if (args.out) {
  const frames = Math.round(dur * FPS);
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(args.audio ? ['-i', args.audio] : []),
    '-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(args.crf || 17),
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    ...(args.audio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []),
    '-r', String(FPS), args.out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${frames} · ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', args.out);
}

await browser.close();
