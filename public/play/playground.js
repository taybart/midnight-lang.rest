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
let run = null // { started, timer, wrote }

const startWorker = () => {
  worker = new Worker('/play/worker.js')
  worker.postMessage({ type: 'init', module: wasmModule })
  worker.onmessage = (e) => {
    if (!run) return
    const msg = e.data
    if (msg.type === 'out') {
      run.wrote = true
      append(msg.text)
    } else if (msg.type === 'done') {
      finish(msg)
    }
  }
}

const stop = (why) => {
  clearTimeout(run.timer)
  run = null
  worker.terminate()
  startWorker()
  append(`\n${why}\n`, 'pg-err')
  setStatus(why, true)
}

const finish = (res) => {
  clearTimeout(run.timer)
  const ms = Math.round(performance.now() - run.started)
  const wrote = run.wrote
  run = null

  luaEl.textContent = res.lua || ''
  if (res.error) {
    // (the traceback's last frame is the host calling in, which says nothing)
    const error = res.error.replace(/\n\t\[G\]: \?/g, '').trimEnd()
    append(`${wrote ? '\n' : ''}${error}\n`, 'pg-err')
  }

  pageTab.disabled = !res.html
  pageEl.srcdoc = res.html || ''
  if (res.html) {
    showTab('page')
  } else if (!wrote && !res.error) {
    append('(nothing printed)', 'pg-note')
  }
  setStatus(res.error ? 'error' : `done in ${ms}ms`, !!res.error)
}

const runCode = () => {
  if (!wasmModule) return
  if (run) stop('stopped')
  outputEl.replaceChildren()
  showTab('output')
  setStatus('running...')
  run = {
    started: performance.now(),
    wrote: false,
    timer: setTimeout(
      () => stop(`stopped: still running after ${TIMEOUT_MS / 1000}s (a loop that never ends?)`),
      TIMEOUT_MS,
    ),
  }
  worker.postMessage({ type: 'run', src: input.value })
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
