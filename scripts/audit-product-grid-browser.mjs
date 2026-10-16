import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, widthArg = '390', outputPrefix = join(tmpdir(), 'pcr-products')] = process.argv.slice(2);
if (!url) throw new Error('Usage: node scripts/audit-product-grid-browser.mjs URL WIDTH OUTPUT_PREFIX');
const width = Number(widthArg);
const height = width < 600 ? 844 : 900;
const profile = await mkdtemp(join(tmpdir(), 'pcr-products-chrome-'));
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
    const callback = pending.get(message.id);
    pending.delete(message.id);
    message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
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
  await sleep(2000);
  await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    [...(dialog?.querySelectorAll('button') || [])].find(x => /Agree|acepto/i.test(x.textContent))?.click();
  })()`);
  await sleep(200);
  const metrics = await evaluate(`(() => {
    const all = [...document.querySelectorAll('.product-card, main li:has(>a[href*="/product/"])')];
    const cards = all.filter(el => el.getClientRects().length).map((el, index) => {
      const box = el.getBoundingClientRect();
      return { index, name: el.querySelector('h2,h3')?.textContent.trim() || '',
        href: el.querySelector('a')?.getAttribute('href') || '',
        x: Math.round(box.x), y: Math.round(box.y + scrollY),
        width: Math.round(box.width), height: Math.round(box.height) };
    });
    const names = new Set();
    const duplicates = [];
    for (const card of cards) {
      const key = card.name.toLowerCase().replace(/\\s+/g, ' ').trim();
      if (names.has(key)) duplicates.push(card.name);
      names.add(key);
    }
    const firstRaw = all[0];
    return { url: location.href, title: document.title, width: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      rawCardCount: all.length,
      firstRaw: firstRaw && { name: firstRaw.querySelector('h2,h3')?.textContent.trim(),
        display: getComputedStyle(firstRaw).display,
        parentDisplay: getComputedStyle(firstRaw.parentElement).display,
        parentClass: firstRaw.parentElement.className,
        rectCount: firstRaw.getClientRects().length,
        ancestors: (() => { const result = []; for (let x = firstRaw; x && result.length < 12; x = x.parentElement) result.push({ tag: x.tagName, className: String(x.className).slice(0, 70), display: getComputedStyle(x).display, rectCount: x.getClientRects().length }); return result; })() },
      cardCount: cards.length, duplicates, firstCards: cards.slice(0, 10) };
  })()`);
  const first = metrics.firstCards[0];
  if (first) {
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: Math.max(0, first.y - 60), width,
        height: Math.min(1500, width < 600 ? first.height * 2.5 + 100 : first.height + 130), scale: 1 },
    });
    await writeFile(`${outputPrefix}-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
