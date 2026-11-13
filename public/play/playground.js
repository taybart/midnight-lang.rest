// The playground (see src/playground.midnight for the markup).
//
// midnight.wasm is compiled once. One instance lives here, for highlighting
// as you type (midnightTokens), and one in a worker runs code (midnightRun),
// so a run that never ends can be stopped by terminating the worker.
import '/play/wasm_exec.js'
import { encode, decode } from '/play/share.js'

const TIMEOUT_MS = 5000
const STORAGE_KEY = 'playground:code'

const EXAMPLES = [
  {
    name: 'Counting sheep',
    code: `local function count_sheep(name = 'night owl', ...sheep) {
  for i, s in ipairs(sheep) {
    print("{name} counts sheep #{i}: {s}")
  }
  return match #sheep {
    0 => { 'still awake' }
    1 | 2 => { 'drowsy' }
    _ => { 'fast asleep' }
  }
}

print(count_sheep(nil, 'dolly', 'shaun', 'timmy'))
`,
  },
  {
    name: 'Tables and destructuring',
    code: `local sky = { moon = 'waning', 'orion', 'lyra' }

local { moon: phase, stars = 0 } = sky
local [ brightest ] = sky
print(phase, stars, brightest)

local function alarm({ hour = 7, snooze = true }) {
  return "alarm at {hour}, snooze {if snooze { 'on' } else { 'off' }}"
}
print(alarm({ hour = 6 }))
`,
  },
  {
    name: 'match and if expressions',
    code: `local function mood(hour) {
  return match hour {
    22 | 23 => { 'winding down' }
    0 | 1 | 2 | 3 | 4 => { 'should be asleep' }
    _ if hour < 12 => { 'morning' }
    _ => { 'awake' }
  }
}

for _, hour in ipairs({ 23, 2, 9, 15 }) {
  local suffix = if hour < 12 { 'am' } else { 'pm' }
  print("{(hour - 1) % 12 + 1}{suffix}: {mood(hour)}")
}
`,
  },
  {
    name: 'Interpolation formats',
    code: `local moon = 0.734
print("the moon is {moon * 100:%.0f}% full")

for hour = 21, 26 {
  print("{hour % 24:%02d}:00  {string.rep('z', hour - 20)}")
}
`,
  },
  {
    name: 'A page (markup)',
    code: `local { css, map } = require('midnight.markup')

local s = css({
  sky = {
    font_family = 'system-ui, sans-serif',
    background = '#0b0f1d',
    color = '#e8ebf4',
    padding = '2rem',
    min_height = '100vh',
    margin = 0,
  },
  star = { color = '#ffcb6b' },
})

local stars = { 'sirius', 'canopus', 'arcturus', 'vega' }

-- return markup and it shows up on the Page tab
return <html>
  <body class={s.sky}>
    <h1>tonight's sky</h1>
    <ul>
      {map(stars, (name, i) -> <li>{i}. <span class={s.star}>{name}</span></li>)}
    </ul>
  </body>
</html>
`,
  },
  {
    name: 'A clickable page',
    code: `local { state, css } = require('midnight.markup')

local s = css({
  sky = {
    font_family = 'system-ui, sans-serif',
    background = '#0b0f1d',
    color = '#e8ebf4',
    padding = '2rem',
    min_height = '100vh',
    margin = 0,
  },
  button = { font_size = '1rem', padding = '.5rem 1rem', cursor = 'pointer' },
})

-- each component keeps its own state between clicks
local Sheep = ({ owl = 'night owl' }) -> {
  local st = state({ count = 0 })
  local mood = match st.count {
    0 => { 'wide awake' }
    1 | 2 | 3 => { 'getting drowsy' }
    _ => { 'fast asleep' }
  }
  return <section>
    <h2>goodnight, {owl}</h2>
    <p>{st.count} sheep so far, {mood}</p>
    <button class={s.button} onclick={() -> {
      st.count += 1
      print("{owl} counted sheep #{st.count}")
    }}>count another</button>
  </section>
}

return <html>
  <body class={s.sky}>
    <Sheep/>
    <Sheep owl="olive"/>
  </body>
</html>
`,
  },
  {
    name: 'A loop that never ends',
    code: `-- runs are stopped after ${TIMEOUT_MS / 1000} seconds
local sheep = 0
while true {
  sheep += 1
}
`,
  },
]

const $ = (id) => document.getElementById(id)
const input = $('pg-input')
const highlightEl = $('pg-highlight')
const outputEl = $('pg-output')
const luaEl = $('pg-lua')
const pageEl = $('pg-page')
const statusEl = $('pg-status')
const runBtn = $('pg-run')
const shareBtn = $('pg-share')
const examplesEl = $('pg-examples')
const tabs = document.querySelectorAll('.pg-tabs button')
const panes = document.querySelectorAll('.pg-pane')

const setStatus = (text, err = false) => {
  statusEl.textContent = text
  statusEl.classList.toggle('err', err)
}

// tabs -----------------------------------------------------------------------

const showTab = (name) => {
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name))
  panes.forEach((p) => { p.hidden = p.dataset.pane !== name })
}
tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)))
const pageTab = document.querySelector('.pg-tabs [data-tab="page"]')

// highlighting -----------------------------------------------------------------

// token kinds from the compiler's lexer -> the docs' classes (see lib/highlight.mn)
const CLASS = {
  keyword: 'tok-keyword', constant: 'tok-const', number: 'tok-number',
  string: 'tok-string', interp: 'tok-interp', format: 'tok-interp',
  comment: 'tok-comment', markup: 'tok-punct', tag: 'tok-tag', attr: 'tok-attr',
}
const BUILTIN = new Set([
  'print', 'require', 'type', 'tostring', 'tonumber', 'pairs', 'ipairs', 'next',
  'select', 'error', 'assert', 'pcall', 'xpcall', 'setmetatable', 'getmetatable',
  'rawget', 'rawset', 'rawequal', 'unpack', 'string', 'table', 'math', 'io', 'os',
  'coroutine',
])
const PUNCT = new Set(['(', ')', '[', ']', ';', ':', ',', '.', '{', '}'])

const nextToken = (toks, i) => {
  let t = toks[i + 1]
  if (t && t[0] === 'plain' && !t[1].trim()) t = toks[i + 2]
  return t
}

const highlight = () => {
  const src = input.value
  // (a trailing newline needs a character after it to take up a line)
  if (!window.midnightTokens) {
    highlightEl.textContent = src + ' '
    return
  }
  const toks = midnightTokens(src)
  const frag = document.createDocumentFragment()
  toks.forEach(([kind, text], i) => {
    let cls = CLASS[kind]
    if (kind === 'word') {
      const next = nextToken(toks, i)
      if (BUILTIN.has(text)) cls = 'tok-builtin'
      else if (text === 'match' && next && next[0] !== 'symbol') cls = 'tok-keyword'
      else if (next && next[0] === 'symbol' && next[1] === '(') cls = 'tok-function'
    } else if (kind === 'symbol') {
      cls = PUNCT.has(text) ? 'tok-punct' : 'tok-operator'
    }
    if (cls) {
      const span = document.createElement('span')
      span.className = cls
      span.textContent = text
      frag.append(span)
    } else {
      frag.append(text)
    }
  })
  frag.append(' ')
  highlightEl.replaceChildren(frag)
}

const syncScroll = () => {
  highlightEl.parentElement.scrollTop = input.scrollTop
  highlightEl.parentElement.scrollLeft = input.scrollLeft
}

// output -------------------------------------------------------------------------

const append = (text, cls) => {
  if (!cls) {
    outputEl.append(text)
    return
  }
  const span = document.createElement('span')
  span.className = cls
  span.textContent = text
  outputEl.append(span)
}

// running --------------------------------------------------------------------------

let wasmModule
let worker
let run = null // the run in progress: { started, timer, wrote }
let action = null // the page action in progress: { req, started, timer }
let pageLive = false // whether the worker holds the shown page's state

const startWorker = () => {
  worker = new Worker('/play/worker.js')
  worker.postMessage({ type: 'init', module: wasmModule })
  worker.onmessage = (e) => {
    const msg = e.data
    if (msg.type === 'out') {
      if (run) run.wrote = true
      append(msg.text)
    } else if (msg.type === 'done' && run) {
      finish(msg)
    } else if (msg.type === 'dispatched' && action) {
      finishAction(msg)
    }
  }
}

// cleanError keeps the traceback frames in the user's code (the rest are
// the runtime and the playground calling in, which says nothing useful)
const cleanError = (error) => {
  const [message, trace] = error.split('\nstack traceback:\n')
  if (trace === undefined) return error.trimEnd()
  const frames = trace.split('\n').filter((l) => l.includes('playground.mn:'))
  return (frames.length ? `${message}\nstack traceback:\n${frames.join('\n')}` : message).trimEnd()
}

// stop ends whatever is running by replacing the worker (and the page's
// state goes w/ it)
const stop = (why) => {
  for (const job of [run, action]) if (job) clearTimeout(job.timer)
  run = action = null
  pageLive = false
  worker.terminate()
  startWorker()
  append(`\n${why}\n`, 'pg-err')
  setStatus(why, true)
}

const timeout = (what) => setTimeout(
  () => stop(`stopped: ${what} still running after ${TIMEOUT_MS / 1000}s (a loop that never ends?)`),
  TIMEOUT_MS,
)

const finish = (res) => {
  clearTimeout(run.timer)
  const ms = Math.round(performance.now() - run.started)
  const wrote = run.wrote
  run = null

  luaEl.textContent = res.lua || ''
  if (res.error) append(`${wrote ? '\n' : ''}${cleanError(res.error)}\n`, 'pg-err')

  pageLive = !!res.interactive
  pageTab.disabled = !res.html
  pageEl.srcdoc = res.html ? withBridge(res.html) : ''
  if (res.html) {
    showTab('page')
  } else if (!wrote && !res.error) {
    append('(nothing printed)', 'pg-note')
  }
  if (res.error) setStatus('error', true)
  else setStatus(`done in ${ms}ms${pageLive ? ', the page is live' : ''}`)
}

const runCode = () => {
  if (!wasmModule) return
  if (run || action) stop('stopped')
  outputEl.replaceChildren()
  showTab('output')
  setStatus('running...')
  pageLive = false
  run = { started: performance.now(), wrote: false, timer: timeout('the code is') }
  worker.postMessage({ type: 'run', src: input.value })
}

// clickable pages ------------------------------------------------------------------

// The page's client script POSTs each action (ex. a click) to its server. In
// the iframe, the bridge answers those requests instead: it hands them to
// this page (postMessage), which runs them in the worker, where the page's
// state lives, and sends back what changed. The iframe is sandboxed w/o
// allow-same-origin, so it can only talk to us through messages.
const RPC_PATH = '/__midnight_rpc__' // (the rpc url the wasm mounts pages with)
const BRIDGE = `<script>(() => {
  const pending = new Map()
  let next = 0
  const fetch = window.fetch.bind(window)
  window.fetch = (url, opts) => {
    if (url !== '${RPC_PATH}') return fetch(url, opts)
    const { id, data } = JSON.parse(opts.body)
    const req = ++next
    return new Promise((resolve) => {
      pending.set(req, resolve)
      parent.postMessage({ type: 'midnight:rpc', req, action: id, data }, '*')
    })
  }
  addEventListener('message', (e) => {
    const msg = e.data
    if (e.source !== parent || !msg || msg.type !== 'midnight:rpc-result') return
    const resolve = pending.get(msg.req)
    if (!resolve) return
    pending.delete(msg.req)
    resolve(new Response(msg.error ?? msg.html ?? '', {
      status: msg.error ? 500 : 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }))
  })
})()</script>`

// withBridge puts the bridge first, so it's there before the page's scripts
const withBridge = (html) => html.replace(/^(<!DOCTYPE html>)?/i, (doctype) => doctype + BRIDGE)

const reply = (req, res) =>
  pageEl.contentWindow?.postMessage({ type: 'midnight:rpc-result', req, html: res.html, error: res.error }, '*')

window.addEventListener('message', (e) => {
  const msg = e.data
  if (e.source !== pageEl.contentWindow || !msg || msg.type !== 'midnight:rpc') return
  if (!pageLive || run) {
    reply(msg.req, { error: "the page isn't running anymore (run it again)" })
    return
  }
  // (the client script sends one action at a time)
  action = { req: msg.req, started: performance.now(), timer: timeout('an action is') }
  setStatus('running an action...')
  worker.postMessage({ type: 'dispatch', req: msg.req, action: msg.action, data: msg.data })
})

const finishAction = (res) => {
  clearTimeout(action.timer)
  const ms = Math.round(performance.now() - action.started)
  action = null
  if (res.error) {
    append(`${cleanError(res.error)}\n`, 'pg-err')
    setStatus('an action failed (see Output)', true)
  } else {
    setStatus(`action ran in ${ms}ms`)
  }
  reply(res.req, res)
}

// editing ------------------------------------------------------------------------

let saveTimer
const changed = () => {
  highlight()
  syncScroll()
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, input.value) } catch (e) {}
  }, 300)
}

const setCode = (code) => {
  input.value = code
  input.scrollTop = 0
  changed()
}

input.addEventListener('input', changed)
input.addEventListener('scroll', syncScroll)
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    runCode()
  } else if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    // (execCommand keeps the browser's undo history, setRangeText doesn't)
    if (!document.execCommand('insertText', false, '  ')) {
      input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end')
      changed()
    }
  }
})
runBtn.addEventListener('click', runCode)

EXAMPLES.forEach((ex, i) => examplesEl.append(new Option(ex.name, i)))
examplesEl.prepend(new Option('Examples...', '', true, true))
examplesEl.addEventListener('change', () => {
  const ex = EXAMPLES[examplesEl.value]
  if (ex) setCode(ex.code)
  examplesEl.value = ''
})

shareBtn.addEventListener('click', async () => {
  history.replaceState(null, '', `#code=${await encode(input.value)}`)
  try {
    await navigator.clipboard.writeText(location.href)
    setStatus('link copied')
  } catch (e) {
    setStatus('link is in the address bar')
  }
})

// startup ------------------------------------------------------------------------

const initialCode = async () => {
  const m = location.hash.match(/^#code=(.+)$/)
  if (m) {
    try { return await decode(m[1]) } catch (e) { setStatus('that link is broken', true) }
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
  } catch (e) {}
  return EXAMPLES[0].code
}

// The wasm is shipped gzipped (see the Makefile) and decompressed here, so
// it doesn't depend on the server compressing it.
const loadWasm = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const wasm = new Response(res.body.pipeThrough(new DecompressionStream('gzip')), {
    headers: { 'Content-Type': 'application/wasm' },
  })
  return WebAssembly.compileStreaming(wasm)
}

const boot = async () => {
  setCode(await initialCode())
  wasmModule = await loadWasm('/play/midnight.wasm.gz')
  const go = new Go()
  go.run(await WebAssembly.instantiate(wasmModule, go.importObject))
  startWorker()
  highlight()
  runBtn.disabled = false
  setStatus('ready (ctrl / cmd + enter runs)')
  input.focus()
}

boot().catch((e) => setStatus(`couldn't load midnight: ${e.message}`, true))
