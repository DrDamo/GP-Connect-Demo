---
name: run-gp-connect-demo
description: run, start, build, screenshot, test, launch, drive the GP Connect Demonstrator web app. Use when asked to run the app, take a screenshot, check a domain view, or validate UI changes.
---

GP Connect Demonstrator is a React + Vite + TypeScript web app that renders FHIR STU3 clinical bundles. It runs a local dev server on port 5173. The agent path is: start the server, drive it with a Node.js CDP script (Chrome DevTools Protocol via `chromium --remote-debugging-port`), take screenshots, and stop.

No `chromium-cli` package is available. Use the inline CDP approach documented below.

## Prerequisites

```bash
# Node.js ≥ 18 (project uses v24), npm
# Chromium (available as snap)
which chromium   # → /snap/bin/chromium
chromium --version  # → Chromium 148.x

# ws package needed for CDP driver — install in /tmp to avoid polluting project
cd /tmp && npm init -y && npm install ws
```

## Build

```bash
cd /home/drdamo/GP-Connect-Demo
npm install
npm run build   # Vite build to dist/; TypeScript must pass cleanly
```

## Run (agent path)

### 1. Start the dev server in the background

```bash
cd /home/drdamo/GP-Connect-Demo
npm run dev &
sleep 3
curl -s http://localhost:5173/GP-Connect-Demo/ | grep -c '<html' || echo "server up"
```

The app is at **http://localhost:5173/GP-Connect-Demo/** (note the `/GP-Connect-Demo/` base path — Vite's `base` config matches the GitHub Pages repo name).

### 2. Drive with CDP (Node.js script)

Save this as `/tmp/drive-gpc.cjs` and run with `node /tmp/drive-gpc.cjs`:

```javascript
const http = require('http')
const WebSocket = require('/tmp/node_modules/ws')
const { spawn } = require('child_process')
const { writeFileSync, mkdirSync } = require('fs')

const PORT = 9334            // change if another process has 9334
const BASE = 'http://localhost:5173/GP-Connect-Demo/'
const SS_DIR = '/tmp/gpc-ss'

function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9)
    const handler = (data) => {
      const msg = JSON.parse(data)
      if (msg.id === id) {
        ws.off('message', handler)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
    ws.on('message', handler)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => resolve(JSON.parse(body)))
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function screenshot(ws, path) {
  const { data } = await cdp(ws, 'Page.captureScreenshot', { format: 'png' })
  writeFileSync(path, Buffer.from(data, 'base64'))
  console.log('Screenshot:', path)
}

async function clickButton(ws, textMatch) {
  const result = await cdp(ws, 'Runtime.evaluate', {
    expression: `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('${textMatch}'))?.click()`,
    awaitPromise: false
  })
  return result
}

async function main() {
  mkdirSync(SS_DIR, { recursive: true })

  const proc = spawn('chromium', [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-sandbox',
    '--window-size=1400,900',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    BASE
  ], { stdio: 'ignore' })

  await sleep(3000)

  const targets = await get(`http://localhost:${PORT}/json`)
  const pageTarget = targets.find(t => t.type === 'page') || targets[0]
  console.log('Connected to:', pageTarget.url)

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
  await new Promise(r => ws.on('open', r))
  await cdp(ws, 'Runtime.enable')
  await cdp(ws, 'Page.enable')
  await sleep(2000)

  // 1. Upload screen
  await screenshot(ws, `${SS_DIR}/01-upload.png`)

  // 2. Load sample bundle
  await clickButton(ws, 'Load sample')
  await sleep(2500)
  await screenshot(ws, `${SS_DIR}/02-medications.png`)

  // 3. Navigate domains (adapt as needed)
  for (const domain of ['Allergies', 'Problems', 'Consultations', 'Referrals']) {
    await cdp(ws, 'Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('${domain}'))?.click()`
    })
    await sleep(800)
    await screenshot(ws, `${SS_DIR}/${domain.toLowerCase()}.png`)
  }

  ws.close()
  proc.kill()
  console.log('Done. Screenshots in', SS_DIR)
}

main().catch(e => { console.error(e); process.exit(1) })
```

### 3. Inspect screenshots

```bash
ls /tmp/gpc-ss/
# Read any .png with the Read tool to visually verify the UI
```

## Run (human path)

```bash
cd /home/drdamo/GP-Connect-Demo
npm run dev
# Opens http://localhost:5173/GP-Connect-Demo/ in a browser
# Ctrl-C to stop
```

## Test

```bash
cd /home/drdamo/GP-Connect-Demo
npm run build   # TypeScript compile + Vite bundle (no separate test suite)
```

TypeScript errors surface here. The project has no Jest/Vitest unit tests — visual verification via the CDP script is the primary correctness check.

## Gotchas

- **Base path is `/GP-Connect-Demo/`** — not `/`. Going to `http://localhost:5173/` returns a blank page. Always use the full path.
- **CDP connects to wrong target** — snap chromium loads its extensions first, so `targets[0]` may be a `chrome-extension://` background page. Always filter with `targets.find(t => t.type === 'page')`.
- **Port 9333 already in use** — if a previous chromium process wasn't killed cleanly, port 9333 may still be bound. Use 9334 or `pkill chromium` first.
- **`ws` package must be in `/tmp/node_modules/`** — the project doesn't depend on it; install it in `/tmp` to avoid touching `package.json`.
- **`--disable-extensions` is required** — without it, the snap extension registers as the first CDP target, confusing target selection.
- **Screenshot of upload screen shows blank** if Vite hasn't finished serving by the time chromium connects. The 3-second sleep is sufficient on this machine; increase to 5 if needed.
- **Domain nav buttons contain count badges** — `b.textContent.trim().startsWith('Allergies')` is more reliable than `.includes()` because the button text renders as `"Allergies 3"` in some states.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: ECONNREFUSED` connecting to CDP port | Chromium didn't start in time — increase `sleep(3000)` to 5000 |
| All screenshots are blank/white | Vite server not running; confirm `curl http://localhost:5173/GP-Connect-Demo/` returns HTML |
| `Cannot find package 'ws'` | Run `cd /tmp && npm init -y && npm install ws` first |
| Build fails with `Cannot find namespace 'JSX'` | Return types on React components must be inferred — remove explicit `: JSX.Element` annotations |
| `npm run dev` port 5173 already in use | `pkill -f vite` or use `--port 5174` |
