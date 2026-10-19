import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base = 'http://127.0.0.1:3100', widthArg = '390'] = process.argv.slice(2);
const width = Number(widthArg);
const height = width < 600 ? 844 : 900;
const paths = process.argv[4] ? [process.argv[4]] : [
  '/es/', '/es/acerca-de/', '/es/peptidos-para-la-perdida-de-peso/',
  '/es/adamax-costa-rica/', '/es/producto/5-amino-1mq-50mg/',
  '/es/alajuela/', '/es/blog/los-peptidos-son-esteroides/',
  '/es/politica-de-privacidad/',
];
const outputDir = join(tmpdir(), 'pcr-spanish-qa');
await mkdir(outputDir, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'pcr-spanish-chrome-'));
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
  socket = new WebSocket(targets.find((item) => item.type === 'page').webSocketDebuggerUrl);
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
  const rows = [];
  for (const path of paths) {
    await send('Page.navigate', { url: new URL(path, base).href });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState') === 'complete') break;
      await sleep(100);
    }
    await sleep(450);
    await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      [...(dialog?.querySelectorAll('button') || [])].find((button) => /Agree|acepto/i.test(button.textContent))?.click();
    })()`);
    await sleep(150);
    const row = await evaluate(`(() => ({
      path: location.pathname, lang: document.documentElement.lang,
      alternateHref: document.querySelector('a[hreflang]')?.getAttribute('href') || '',
      title: document.title, h1: document.querySelector('main h1')?.textContent.trim() || '',
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      text: (document.querySelector('main')?.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 420),
      overflow: [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(element).display !== 'none')
        .slice(0, 12).map((element) => ({ tag: element.tagName, className: typeof element.className === 'string' ? element.className.slice(0, 100) : '', text: element.textContent.trim().slice(0, 70), previous: element.previousElementSibling?.textContent.trim().slice(0, 100), parentClass: element.parentElement?.className?.slice?.(0, 120), right: Math.round(element.getBoundingClientRect().right) })),
      notFound: Boolean(document.querySelector('h1')?.textContent.includes('404')),
    }))()`);
    const slug = path === '/es/' ? 'home' : path.split('/').filter(Boolean).at(-1);
    const screenshot = join(outputDir, `${slug}-${width}.png`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(screenshot, Buffer.from(shot.data, 'base64'));
    rows.push({ ...row, screenshot });
  }
  console.log(JSON.stringify(rows, null, 2));
  if (rows.some((row) => row.lang !== 'es' || !row.h1 || row.notFound || row.documentWidth > width + 1)) process.exitCode = 1;
} finally {
  socket?.close();
  chrome.kill();
}
