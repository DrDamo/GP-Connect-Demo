// Drives the GP Connect Demonstrator in headless Chromium over the Chrome
// DevTools Protocol: signs in (session cookie), loads a bundle, opens a tab,
// optionally runs profile validation, and saves screenshots.
//
//   GPC_COOKIE=<gpc_session value> node drive.cjs
//
// Environment (all optional except GPC_COOKIE):
//   GPC_BASE      app URL                      default http://localhost:5173/
//   GPC_BUNDLE    bundle file to load          default <repo>/public/gpc-sample-bundle.json
//   GPC_TAB       tab to open after loading    default Clinical View
//   GPC_DOMAINS   comma list of Clinical View areas to screenshot, e.g. "Allergies,Immunisations"
//   GPC_PROFILE   "1" to click "Validate against profiles" on the Validation tab and wait
//   GPC_OUT       screenshot folder            default ./gpc-ss
//   GPC_CDP_PORT  Chromium debugging port      default 9341
//
// Needs the `ws` package: run `npm i ws@8.18.0` in a scratch folder and run
// this script from that folder (`ws` is resolved from the current directory).

const http = require('http')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
// Resolved from the folder the script is run from, not this skill folder.
const WebSocket = require(require.resolve('ws', { paths: [process.cwd()] }))

const BASE = process.env.GPC_BASE || 'http://localhost:5173/'
const BUNDLE = process.env.GPC_BUNDLE || path.resolve(__dirname, '../../../public/gpc-sample-bundle.json')
const TAB = process.env.GPC_TAB || 'Clinical View'
const DOMAINS = (process.env.GPC_DOMAINS || '').split(',').map(s => s.trim()).filter(Boolean)
const OUT = path.resolve(process.env.GPC_OUT || 'gpc-ss')
const PORT = Number(process.env.GPC_CDP_PORT || 9341)
const COOKIE = process.env.GPC_COOKIE

if (!COOKIE) { console.error('Set GPC_COOKIE to a gpc_session cookie value (see SKILL.md, "Sign in").'); process.exit(2) }
fs.mkdirSync(OUT, { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))
const getJson = url => new Promise((res, rej) => http.get(url, r => { let b = ''; r.on('data', d => { b += d }); r.on('end', () => res(JSON.parse(b))) }).on('error', rej))

let ws
let nextId = 0
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    const onMessage = data => {
      const msg = JSON.parse(data)
      if (msg.id !== id) return
      ws.off('message', onMessage)
      msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)
    }
    ws.on('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })
}
const js = async expr => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value
const bodyText = () => js('document.body.innerText')
/** New users get an onboarding tour per tab/area that covers the page.
 *  Skip any that are open (each skip can reveal the next). */
async function skipTours() {
  for (let i = 0; i < 5; i++) {
    const skipped = await js(`(() => {
      const b = [...document.querySelectorAll('button,a')].find(b => b.textContent.trim() === 'Skip tour')
      if (b) b.click()
      return !!b
    })()`)
    if (!skipped) return
    console.log('skipped an onboarding tour')
    await sleep(500)
  }
}
async function shot(name) {
  await skipTours()
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' })
  const file = path.join(OUT, `${name}.png`)
  fs.writeFileSync(file, Buffer.from(data, 'base64'))
  console.log('screenshot', file)
}
/** Clicks the first button or link whose trimmed text starts with `text`. */
const click = text => js(`(() => {
  const el = [...document.querySelectorAll('button,a')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)}))
  if (el) el.click()
  return !!el
})()`)
async function waitFor(test, timeoutMs, label) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await js(test)) return true
    await sleep(500)
  }
  console.log(`timed out waiting for ${label}`)
  return false
}

;(async () => {
  const profileDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gpc-chromium-'))
  const chromium = spawn('chromium', [
    `--remote-debugging-port=${PORT}`, '--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--disable-extensions', '--window-size=1400,1000',
    `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore' })
  try {
    let page
    for (let i = 0; i < 40 && !page; i++) {
      await sleep(250)
      page = await getJson(`http://localhost:${PORT}/json`).then(t => t.find(x => x.type === 'page')).catch(() => undefined)
    }
    if (!page) throw new Error('Chromium did not start')
    ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise(r => ws.on('open', r))
    await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable')

    // Sign in by planting the HttpOnly session cookie, then open the app.
    const host = new URL(BASE).hostname
    await cdp('Network.setCookie', { name: 'gpc_session', value: COOKIE, domain: host, path: '/', httpOnly: true })
    await cdp('Page.navigate', { url: BASE })
    if (!await waitFor(`document.querySelector('input[type=file]') !== null`, 15000, 'the signed-in workspace')) {
      await shot('00-not-signed-in')
      throw new Error('No file picker: the cookie was not accepted (expired, wrong host, or the backend is down)')
    }
    await shot('01-home')

    // Load the bundle through the file picker.
    const { root } = await cdp('DOM.getDocument')
    const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
    await cdp('DOM.setFileInputFiles', { nodeId, files: [BUNDLE] })
    await waitFor(`/Load different file/.test(document.body.innerText)`, 30000, 'the bundle to load')
    await sleep(1500)

    // Skipping a tour can switch tabs, so choose the tab again afterwards.
    await skipTours()
    await click(TAB)
    await sleep(1500)
    await skipTours()
    await click(TAB)
    await sleep(1000)
    await shot('02-' + TAB.toLowerCase().replace(/\W+/g, '-'))

    for (const domain of DOMAINS) {
      await click(domain)
      await sleep(1000)
      await shot('domain-' + domain.toLowerCase().replace(/\W+/g, '-'))
    }

    if (process.env.GPC_PROFILE === '1') {
      await click('Validation')
      await sleep(1000)
      if (!await click('Validate against profiles')) {
        console.log('No profile validation button: VALIDATOR_URL is not set on the server')
      } else {
        await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Validate again') || /Could not reach the validator|Validation took too long|validator failed/.test(document.body.innerText)`, 180000, 'profile validation')
        await shot('03-profile-validation')
      }
    }

    console.log('page text (first 300 chars):', (await bodyText()).slice(0, 300).replace(/\n+/g, ' | '))
  } finally {
    ws?.close()
    chromium.kill()
    fs.rmSync(profileDir, { recursive: true, force: true })
  }
})().catch(err => { console.error(err.message || err); process.exit(1) })
