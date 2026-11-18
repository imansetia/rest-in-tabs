// Render the extension icon PNGs into public/icons/ from the sources in
// design/icon/ (design steering file, Extension icon):
//   icon-16.svg → icon-16.png (the 16 px drawing; the master is never scaled down to 16)
//   icon.svg    → icon-32.png, icon-48.png, icon-128.png
// The corners outside the rounded square stay transparent.
//
// Node built-ins only, plus a locally installed Edge or Chrome run headless
// over the DevTools protocol (set BROWSER_PATH to choose one). Run with
// "npm run icons"; the PNGs are committed, so "npm run build" needs no browser.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const JOBS = [
  { source: 'icon-16.svg', size: 16 },
  { source: 'icon.svg', size: 32 },
  { source: 'icon.svg', size: 48 },
  { source: 'icon.svg', size: 128 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const env = process.env;
  const candidates = [
    env.BROWSER_PATH,
    env['ProgramFiles(x86)'] && join(env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    env.ProgramFiles && join(env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    env.ProgramFiles && join(env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env['ProgramFiles(x86)'] && join(env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Edge or Chrome found. Set BROWSER_PATH to the browser executable.');
  return found;
}

/** A minimal DevTools protocol client over the WebSocket built into Node. */
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (waiter === undefined) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
    else waiter.resolve(message.result);
  };
  return new Promise((resolve, reject) => {
    ws.onerror = () => reject(new Error(`Could not connect to ${url}`));
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, { resolve: res, reject: rej, method });
        ws.send(JSON.stringify({ id: i, method, params }));
      }),
      close: () => ws.close(),
    });
  });
}

async function render() {
  const browserPath = findBrowser();
  const profile = mkdtempSync(join(tmpdir(), 'rest-in-tabs-icons-'));
  const browser = spawn(browserPath, [
    '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    // The browser writes its port into DevToolsActivePort once it is listening.
    const portFile = join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
    if (!existsSync(portFile)) throw new Error('The browser did not start its DevTools server.');
    const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
    let page;
    for (let i = 0; i < 50 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not yet */ }
      if (!page) await sleep(100);
    }
    if (!page) throw new Error('No page target in the browser.');
    const cdp = await connect(page.webSocketDebuggerUrl);
    // A transparent page, so the corners outside the rounded square stay transparent.
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

    const outDir = join(root, 'public', 'icons');
    mkdirSync(outDir, { recursive: true });
    for (const { source, size } of JOBS) {
      const svg = readFileSync(join(root, 'design', 'icon', source));
      const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block}</style></head>`
        + `<body><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${svg.toString('base64')}"></body></html>`;
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(html).toString('base64')}` });
      for (let i = 0; i < 50; i++) {
        const ready = await cdp.send('Runtime.evaluate', { expression: 'document.images[0]?.complete && document.images[0].naturalWidth > 0', returnByValue: true });
        if (ready.result.value === true) break;
        await sleep(50);
      }
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
      const png = Buffer.from(shot.data, 'base64');
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      if (width !== size || height !== size) throw new Error(`${source} at ${size} px came out ${width} × ${height}.`);

      // Read the PNG back: the top-left corner must be transparent and the centre opaque.
      const probe = await cdp.send('Runtime.evaluate', {
        awaitPromise: true, returnByValue: true,
        expression: `new Promise((resolve) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = ${size};
          const x = c.getContext('2d'); x.drawImage(img, 0, 0); const px = (a, b) => [...x.getImageData(a, b, 1, 1).data];
          resolve({ corner: px(0, 0), centre: px(${Math.floor(size / 2)}, ${Math.floor(size / 2)}) }); }; img.src = 'data:image/png;base64,${shot.data}'; })`,
      });
      const { corner, centre } = probe.result.value;
      if (corner[3] !== 0 || centre[3] !== 255) throw new Error(`${source} at ${size} px: corner alpha ${corner[3]}, centre alpha ${centre[3]}.`);

      const name = `icon-${size}.png`;
      writeFileSync(join(outDir, name), png);
      console.log(`public/icons/${name}  ${width} × ${height}  ${png.length} bytes  from design/icon/${source}  (corner alpha ${corner[3]}, centre rgba ${centre.join(',')})`);
    }
    cdp.close();
  } finally {
    browser.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

render().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
