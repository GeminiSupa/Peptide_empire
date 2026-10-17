import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, widthArg = '390', outputPrefix = 'home-audit'] = process.argv.slice(2);
if (!url) throw new Error('Usage: node scripts/audit-home-browser.mjs URL WIDTH OUTPUT_PREFIX');
const width = Number(widthArg);
const height = width < 600 ? 844 : 900;
const profile = await mkdtemp(join(tmpdir(), 'pcr-chrome-'));
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
  await sleep(3000);
  const ageGateAccepted = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const button = [...dialog.querySelectorAll('button')].find(x => /Agree|acepto/i.test(x.textContent));
    button?.click();
    return Boolean(button);
  })()`);
  if (ageGateAccepted) await sleep(250);
  const topShot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${outputPrefix}-${width}-top.png`, Buffer.from(topShot.data, 'base64'));
  const metrics = await evaluate(`(() => {
    const headings = [...document.querySelectorAll('.home-page h1,.home-page h2')].map(x => x.textContent.trim());
    const sections = [...document.querySelectorAll('[data-home-section]')].map(x => ({
      id: x.getAttribute('data-home-section'), top: Math.round(x.getBoundingClientRect().top + scrollY),
      height: Math.round(x.getBoundingClientRect().height),
      cards: x.querySelectorAll('.product-card').length,
      products: [...x.querySelectorAll('.product-card h2')].map(i => i.textContent.trim()),
      images: [...x.querySelectorAll('img')].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src),
    }));
    return { title: document.title, href: location.href, width: innerWidth,
      documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
      height: document.documentElement.scrollHeight, headings, sections,
      schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map(x => { try { return JSON.parse(x.textContent)['@type'] || 'graph'; } catch { return 'invalid'; } }),
      aboutMobileApp: [...document.querySelectorAll('a')].filter(a => /Mobile App|Aplicación Móvil/.test(a.textContent)).map(a => ({text:a.textContent.trim(),href:a.href})),
      whatsappLinks: [...document.querySelectorAll('a[href*="wa.me"]')].length,
      contactButtons: [...document.querySelectorAll('a.contact-cta')].map(x => ({
        text: x.textContent.trim(), href: x.href,
        background: getComputedStyle(x).backgroundColor,
        color: getComputedStyle(x).color,
        visible: Boolean(x.getClientRects().length),
        width: Math.round(x.getBoundingClientRect().width),
      })),
      mapLinks: [...document.querySelectorAll('footer a[href*="maps.app.goo.gl"]')].map(x => x.href),
      footerLogo: document.querySelector('footer img[alt="Peptides Costa Rica"]')?.src,
    };
  })()`);
  for (const section of metrics.sections.filter((s) => ['0', '1', '2', '3', '5', '6', '7', '8', '9', '10', '11'].includes(s.id))) {
    await evaluate(`(async () => {
      const section = document.querySelector('[data-home-section="${section.id}"]');
      const images = [...section.querySelectorAll('img')];
      images.forEach(image => { image.loading = 'eager'; });
      await Promise.race([Promise.all(images.map(image => image.decode().catch(() => {}))),
        new Promise(resolve => setTimeout(resolve, 8000))]);
    })()`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: Math.max(0, section.top), width, height: Math.min(1500, section.height + 60), scale: 1 } });
    await writeFile(`${outputPrefix}-${width}-section-${section.id}.png`, Buffer.from(shot.data, 'base64'));
  }
  const footer = await evaluate(`(() => {
    const box = document.querySelector('footer').getBoundingClientRect();
    return { top: Math.round(box.top + scrollY), height: Math.round(box.height) };
  })()`);
  const footerShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: footer.top, width, height: Math.min(1450, footer.height), scale: 1 } });
  await writeFile(`${outputPrefix}-${width}-footer.png`, Buffer.from(footerShot.data, 'base64'));
  const map = await evaluate(`(() => {
    const frame = document.querySelector('footer iframe[src*="google.com/maps"]');
    frame?.scrollIntoView({ block: 'center' });
    const box = frame?.getBoundingClientRect();
    return box ? { top: Math.round(box.top + scrollY), height: Math.round(box.height) } : null;
  })()`);
  if (map) {
    await sleep(4000);
    const mapShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: Math.max(0, map.top - 20), width, height: map.height + 90, scale: 1 } });
    await writeFile(`${outputPrefix}-${width}-map.png`, Buffer.from(mapShot.data, 'base64'));
  }
  metrics.ageGateAccepted = ageGateAccepted;
  await evaluate(`(() => {
    const browser = document.querySelector('#shop-by-product');
    const button = [...(browser?.querySelectorAll('button') || [])].find(x => x.textContent.trim() === 'A');
    button?.click();
  })()`);
  await sleep(200);
  metrics.alphabetA = await evaluate(`(() => [...(document.querySelector('#shop-by-product')?.querySelectorAll('.product-card h2') || [])].map(x => x.textContent.trim()))()`);
  if (width < 600 || (url.includes('/es/') && width < 1200)) {
    await evaluate(`(() => {
      document.querySelector('button[aria-label="Open menu"],button[aria-label="Abrir menú"]')?.click();
    })()`);
    await sleep(200);
    await evaluate(`(() => { document.querySelector('nav[aria-label="Menu"] button[aria-label$=" submenu"],nav[aria-label="Menú"] button[aria-label^="Submenú de "]')?.click(); })()`);
    await sleep(200);
    metrics.mobileAppInMenu = await evaluate(`(() => [...document.querySelectorAll('nav a')].some(x => /Mobile App|Aplicación Móvil/.test(x.textContent) && x.getClientRects().length > 0))()`);
    const menuShot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${outputPrefix}-${width}-menu.png`, Buffer.from(menuShot.data, 'base64'));
  }
  if (width >= 1280) {
    await evaluate(`document.querySelector('button[aria-controls="site-search-panel"]')?.click()`);
    await sleep(200);
    metrics.searchPanelVisible = await evaluate(`Boolean(document.querySelector('#site-search-panel input')?.getClientRects().length)`);
    metrics.searchInputFocused = await evaluate(`document.activeElement?.id === 'site-search'`);
    const searchShot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${outputPrefix}-${width}-search.png`, Buffer.from(searchShot.data, 'base64'));
  }
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
