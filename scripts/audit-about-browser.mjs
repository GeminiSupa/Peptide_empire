import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, widthArg = '390', outputPrefix = join(tmpdir(), 'pcr-about')] = process.argv.slice(2);
if (!url) throw new Error('Usage: node scripts/audit-about-browser.mjs URL WIDTH OUTPUT_PREFIX');
const width = Number(widthArg);
const height = width < 600 ? 844 : 900;
const profile = await mkdtemp(join(tmpdir(), 'pcr-about-chrome-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions',
  '--disable-background-networking', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      break;
    } catch { await sleep(100); }
  }
  if (!port) throw new Error('Chrome did not start');
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  const target = targets.find((item) => item.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('document.readyState') === 'complete') break;
    await sleep(200);
  }
  await sleep(2500);
  await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    [...(dialog?.querySelectorAll('button') || [])].find(x => /Agree|acepto/i.test(x.textContent))?.click();
  })()`);
  await sleep(250);
  await evaluate(`(async () => {
    const images = [...document.querySelectorAll('.page-about [data-page-section="5"] img')];
    images.forEach(image => { image.loading = 'eager'; });
    await Promise.race([Promise.all(images.map(image => image.decode().catch(() => {}))),
      new Promise(resolve => setTimeout(resolve, 8000))]);
  })()`);
  const metrics = await evaluate(`(() => {
    const wall = document.querySelector('.page-about .review-wall');
    const list = wall?.querySelector('ul');
    const badge = document.querySelector('.page-about .trustpilot-summary');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
    };
    return {
      href: location.href, width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      viewportMeta: document.querySelector('meta[name="viewport"]')?.content,
      sections: [...document.querySelectorAll('.page-about [data-page-section]')].filter(x => x.parentElement?.tagName === 'MAIN').map(x => ({
        id: x.getAttribute('data-page-section'), rect: rect(x),
        heading: x.querySelector('h1,h2,h3')?.textContent.slice(0, 65),
      })),
      section: wall?.closest('[data-page-section]')?.getAttribute('data-page-section'),
      wall: rect(wall), list: rect(list), listScrollWidth: list?.scrollWidth,
      listOverflowX: list && getComputedStyle(list).overflowX,
      cards: [...(list?.children || [])].map(x => ({ rect: rect(x), text: x.textContent.slice(0, 90) })),
      badge: rect(badge), badgeScrollWidth: badge?.scrollWidth, badgeHref: badge?.href,
      ancestors: (() => {
        const result = [];
        for (let x = wall; x && result.length < 8; x = x.parentElement) result.push({
          tag: x.tagName, className: typeof x.className === 'string' ? x.className.slice(0, 90) : '',
          rect: rect(x), overflow: getComputedStyle(x).overflowX, width: getComputedStyle(x).width,
        });
        return result;
      })(),
      trustpilot: [...document.querySelectorAll('.page-about *')].filter(x => x.children.length === 0 && x.textContent.trim() === 'Trustpilot').slice(0, 8).map(x => ({
        rect: rect(x), parent: rect(x.parentElement), grandparent: rect(x.parentElement?.parentElement),
      })),
      reviewImages: [...document.querySelectorAll('.page-about [data-page-section="5"] img')].map(x => ({
        src: x.src, alt: x.alt, rect: rect(x), naturalWidth: x.naturalWidth, naturalHeight: x.naturalHeight,
      })),
    };
  })()`);
  if (metrics.wall) {
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: Math.max(0, metrics.wall.y - 100), width,
        height: Math.min(2000, metrics.wall.height + 180), scale: 1 },
    });
    await writeFile(`${outputPrefix}-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  const reviewSection = metrics.sections.find((section) => section.id === '5');
  if (reviewSection) {
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: reviewSection.rect.y, width,
        height: Math.min(1800, reviewSection.rect.height), scale: 1 },
    });
    await writeFile(`${outputPrefix}-${width}-section-5.png`, Buffer.from(shot.data, 'base64'));
  }
  if (!metrics.wall || metrics.cards.length !== 2 || !metrics.badge) {
    throw new Error('About page reviews or Trustpilot summary are missing');
  }
  if (width < 600) {
    const clipped = [metrics.wall, ...metrics.cards.map((card) => card.rect), metrics.badge]
      .some((box) => box.x < -1 || box.x + box.width > width + 1);
    if (metrics.documentWidth > width || clipped || metrics.listOverflowX === 'auto') {
      throw new Error('About page reviews are clipped or horizontally scrollable on mobile');
    }
  }
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
