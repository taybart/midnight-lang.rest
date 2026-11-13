// The playground (see src/playground.midnight for the markup). This wires
// the pieces to the page:
//
//   editor.js    the code, highlighted as you type (highlight.js) and saved
//   runner.js    runs code in a worker (worker.js), so it can be stopped
//   page.js      the Page tab: returned markup, w/ its clicks working
//   wasm.js      loads midnight.wasm
//   examples.js  the Examples... menu
//   share.js     share links
import { dom, clipboard } from '/js/corvid.bundle.js'
import { Editor, saved } from '/play/editor.js'
import { Runner, cleanError } from '/play/runner.js'
import { PageFrame } from '/play/page.js'
import { loadWasm, start } from '/play/wasm.js'
import { EXAMPLES } from '/play/examples.js'
import { encode, decode } from '/play/share.js'

// corvid's el wraps an element: .on, .text, .value, classes and attrs. What
// it doesn't cover (scroll position, an iframe's window, ...) is on .el, the
// element itself.
const outputEl = new dom.el('#pg-output')
const luaEl = new dom.el('#pg-lua')
const statusEl = new dom.el('#pg-status')
const runBtn = new dom.el('#pg-run')
const shareBtn = new dom.el('#pg-share')
const examplesEl = new dom.el('#pg-examples')
const pageTab = new dom.el('.pg-tabs [data-tab="page"]')

const setDisabled = (el, off) => (off ? el.attr('disabled', '') : el.removeAttr('disabled'))
// (.text, not .content, which is innerHTML: an error can quote markup)
const setStatus = (s, err = false) => statusEl.text(s).toggleClass('err', err)

// output (what the code prints, and errors) ---------------------------------------

const append = (s, cls) =>
  outputEl.append(cls ? dom.create({ tag: 'span', class: cls, text: s }) : s)

// tabs -----------------------------------------------------------------------------

const tabs = dom.els('.pg-tabs button')
const showTab = (name) => {
  tabs.forEach((t) => t.toggleClass('active', t.el.dataset.tab === name))
  // (queried each time: the page's iframe is a pane, and it's replaced each run)
  dom.els('.pg-pane').forEach((p) => {
    p.el.hidden = p.el.dataset.pane !== name
  })
}
tabs.forEach((t) => t.on('click', () => showTab(t.el.dataset.tab)))

// running --------------------------------------------------------------------------

let runner // (once the wasm has loaded)

const editor = new Editor({
  input: '#pg-input',
  highlight: '#pg-highlight',
  onRun: () => runCode(),
})

const page = new PageFrame('#pg-page', ({ req, action, data }) => {
  // (the page's client script sends one action at a time)
  if (!runner?.dispatch(req, action, data)) {
    page.reply(req, { error: "the page isn't running anymore (run it again)" })
    return
  }
  setStatus('running an action...')
})

// on phones, the output is below the editor (and Run floats, see site.css)
const stacked = window.matchMedia('(max-width: 900px)')

const runCode = () => {
  if (!runner) return
  outputEl.empty()
  showTab('output')
  if (stacked.matches) {
    editor.blur() // (closes the keyboard)
    new dom.el('.pg-output').el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  setStatus('running...')
  runner.run(editor.value())
}

const handlers = {
  output: (text) => append(text),

  done: (res, { ms, wrote }) => {
    luaEl.text(res.lua || '')
    if (res.error) append(`${wrote ? '\n' : ''}${cleanError(res.error)}\n`, 'pg-err')

    setDisabled(pageTab, !res.html)
    if (res.html) showTab('page') // (before it loads, see PageFrame.show)
    page.show(res.html)
    if (!res.html && !wrote && !res.error) append('(nothing printed)', 'pg-note')

    if (res.error) setStatus('error', true)
    else setStatus(`done in ${ms}ms${runner.pageLive ? ', the page is live' : ''}`)
  },

  dispatched: (res, { ms }) => {
    if (res.error) {
      append(`${cleanError(res.error)}\n`, 'pg-err')
      setStatus('an action failed (see Output)', true)
    } else {
      setStatus(`action ran in ${ms}ms`)
    }
    page.reply(res.req, res)
  },

  stopped: (why) => {
    append(`\n${why}\n`, 'pg-err')
    setStatus(why, true)
  },
}

runBtn.on('click', runCode)

// examples and sharing -------------------------------------------------------------

EXAMPLES.forEach((ex, i) => examplesEl.append(new Option(ex.name, i)))
examplesEl.prepend(new Option('Examples...', '', true, true))
examplesEl.on('change', () => {
  const ex = EXAMPLES[examplesEl.value()]
  if (ex) editor.set(ex.code)
  examplesEl.value('')
})

shareBtn.on('click', async () => {
  history.replaceState(null, '', `#code=${await encode(editor.value())}`)
  try {
    await clipboard.copy(location.href)
    setStatus('link copied')
  } catch (e) {
    setStatus('link is in the address bar')
  }
})

// startup --------------------------------------------------------------------------

// the code to start with: a share link's, else last visit's, else the first example
const initialCode = async () => {
  const m = location.hash.match(/^#code=(.+)$/)
  if (m) {
    try {
      return await decode(m[1])
    } catch (e) {
      setStatus('that link is broken', true)
    }
  }
  return saved() || EXAMPLES[0].code
}

const boot = async () => {
  editor.set(await initialCode())
  const module = await loadWasm('/play/midnight.wasm.gz')
  await start(module)
  runner = new Runner(module, handlers)
  editor.refresh() // (highlighted, now that the lexer is here)
  setDisabled(runBtn, false)
  // (no keyboard shortcut to mention on a touch screen)
  const touch = window.matchMedia('(pointer: coarse)').matches
  setStatus(touch ? 'ready' : 'ready (ctrl / cmd + enter runs)')
  editor.focus()
}

boot().catch((e) => setStatus(`couldn't load midnight: ${e.message}`, true))
