// Find anything: searches the docs' sections in the browser. The index is
// built on the server from the markdown (GET /search.json, see src/search.mn),
// with each section's url, and fetched the first time search opens.
//
// Opens with ⌘K / Ctrl+K, `/` (when not typing), or the search button; the
// <dialog> is in src/layout.midnight. Every word typed has to match a section
// (its heading, prose, or code), and matches in headings rank first.
import { dom } from '@taybart/corvid'

const dialog = new dom.el('#search')
const input = new dom.el('#search-input')
const results = new dom.el('#search-results')
const MAX_RESULTS = 30

/* the index ------------------------------------------------------------- */

let index = null // [{ page, url, title, level, text, code, ... }], lowercased copies added
let loading = null

const load = () => {
  loading ??= fetch('/search.json')
    .then((res) => {
      if (!res.ok) throw new Error(`search index: ${res.status}`)
      return res.json()
    })
    .then((entries) => {
      index = entries.map((e) => ({
        ...e,
        lTitle: e.title.toLowerCase(),
        lPage: e.page.toLowerCase(),
        lText: e.text.toLowerCase(),
        lCode: e.code.toLowerCase(),
      }))
    })
    .catch((err) => {
      loading = null // (try again next time)
      throw err
    })
  return loading
}

/* matching -------------------------------------------------------------- */

// stem trims a word's ending (ex. destructure / destructured / destructuring
// all match `destructur`), keeping at least 4 letters
const stem = (w) => {
  const s = w.replace(/(ing|ed|es|s|e)$/, '')
  return s.length >= 4 ? s : w
}

const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean)

const isWordStart = (s, i) => i === 0 || !/[\p{L}\p{N}_]/u.test(s[i - 1])

// score ranks a section for the query's words, or 0 when a word is missing:
// the heading counts most (whole, then the start of a word, then anywhere),
// then the page's title, the prose, and the code
const score = (e, ws, q) => {
  let total = 0
  for (const w of ws) {
    const st = stem(w)
    let s = 0
    const t = e.lTitle.indexOf(st)
    if (t >= 0) s += e.lTitle === w ? 60 : isWordStart(e.lTitle, t) ? 30 : 15
    if (e.lPage.includes(st)) s += 4
    const p = e.lText.indexOf(st)
    if (p >= 0) s += isWordStart(e.lText, p) ? 6 : 3
    if (e.lCode.includes(st)) s += 2
    if (s === 0) return 0
    total += s
  }
  if (e.lTitle === q) total += 100 // the whole query is the heading
  return total - e.level // (a section over its subsections, when even)
}

const search = (q) => {
  const ws = words(q)
  if (!ws.length) return []
  const found = []
  index.forEach((e, order) => {
    const s = score(e, ws, ws.join(' '))
    if (s > 0) found.push({ e, s, order })
  })
  found.sort((a, b) => b.s - a.s || a.order - b.order)
  return found.slice(0, MAX_RESULTS).map((f) => f.e)
}

/* rendering ------------------------------------------------------------- */

// appends s to parent, with the query's words in <mark>s (as text nodes, so
// nothing in the docs is parsed as html)
const highlighted = (parent, s, ws) => {
  const lower = s.toLowerCase()
  const marks = []
  for (const w of ws) {
    for (let i = lower.indexOf(w); i >= 0; i = lower.indexOf(w, i + w.length)) {
      marks.push([i, i + w.length])
    }
  }
  marks.sort((a, b) => a[0] - b[0])
  let at = 0
  for (const [from, to] of marks) {
    if (from < at) continue // (overlaps the last one)
    if (from > at) parent.append(s.slice(at, from))
    dom.create({ tag: 'mark', text: s.slice(from, to), parent })
    at = to
  }
  if (at < s.length) parent.append(s.slice(at))
}

// snippet is the section's text around the first match (prose, else code,
// else the section's start), cut at word boundaries
const snippet = (e, ws) => {
  const RADIUS = 70
  for (const [s, ls] of [
    [e.text, e.lText],
    [e.code.replace(/\s+/g, ' '), e.lCode.replace(/\s+/g, ' ')],
  ]) {
    const hits = ws.map((w) => ls.indexOf(w)).filter((i) => i >= 0)
    if (!hits.length) continue
    const hit = Math.min(...hits)
    let from = Math.max(0, hit - RADIUS)
    let to = Math.min(s.length, hit + RADIUS * 2)
    if (from > 0) from = s.indexOf(' ', from) + 1 || from
    if (to < s.length) to = s.lastIndexOf(' ', to) > hit ? s.lastIndexOf(' ', to) : to
    return `${from > 0 ? '…' : ''}${s.slice(from, to).trim()}${to < s.length ? '…' : ''}`
  }
  return e.text.length > RADIUS * 2
    ? `${e.text.slice(0, RADIUS * 2).replace(/\s+\S*$/, '')}…`
    : e.text
}

let shown = [] // the result links, in order
let active = -1

const setActive = (i) => {
  if (!shown.length) return
  active = (i + shown.length) % shown.length
  shown.forEach((a, j) => {
    a.classList.toggle('active', j === active)
    a.setAttribute('aria-selected', j === active)
  })
  shown[active].scrollIntoView({ block: 'nearest' })
  input.attr('aria-activedescendant', shown[active].id)
}

const message = (text) => {
  results.empty()
  dom.create({ tag: 'p', class: 'search-message', text, parent: results.el })
}

const render = () => {
  const q = input.value().trim()
  shown = []
  active = -1
  input.removeAttr('aria-activedescendant')
  if (!q) {
    message('Search headings, prose, and code across the docs.')
    return
  }
  if (!index) {
    message('Loading…')
    return
  }

  const stems = words(q).map(stem)
  const found = search(q)
  if (!found.length) {
    message(`Nothing found for “${q}”.`)
    return
  }

  // grouped by page, in the order of each page's best result
  const groups = new Map()
  for (const e of found) {
    if (!groups.has(e.page)) groups.set(e.page, [])
    groups.get(e.page).push(e)
  }

  results.empty()
  for (const [page, entries] of groups) {
    const group = dom.create({ tag: 'section', class: 'search-group', parent: results.el })
    dom.create({ tag: 'h3', class: 'search-page', text: page, parent: group })
    for (const e of entries) {
      const a = dom.create({
        tag: 'a',
        class: 'search-result',
        id: `search-result-${shown.length}`,
        attrs: { href: e.url, role: 'option', 'aria-selected': 'false' },
        parent: group,
      })
      const title = dom.create({ tag: 'span', class: 'search-title', parent: a })
      highlighted(title, e.title, stems)
      const text = snippet(e, stems)
      if (text)
        highlighted(dom.create({ tag: 'span', class: 'search-snippet', parent: a }), text, stems)
      const i = shown.length
      a.addEventListener('mousemove', () => {
        if (active !== i) setActive(i)
      })
      shown.push(a)
    }
  }
  setActive(0)
}

/* opening and closing --------------------------------------------------- */

const open = () => {
  if (dialog.el.open) return
  dialog.el.showModal()
  input.el.select()
  render()
  load()
    .then(render)
    .catch(() => message('Search is unavailable right now, try again in a bit.'))
}

const close = () => dialog.el.close()

// a link to this page only changes the hash, so close first and let the
// browser scroll to it (a link elsewhere navigates as usual)
const go = (a) => {
  close()
  location.href = a.href
}

input.on('input', render)
input.on('keydown', (ev) => {
  if (ev.key === 'ArrowDown' || (ev.key === 'n' && ev.ctrlKey)) {
    ev.preventDefault()
    setActive(active + 1)
  } else if (ev.key === 'ArrowUp' || (ev.key === 'p' && ev.ctrlKey)) {
    ev.preventDefault()
    setActive(active - 1)
  } else if (ev.key === 'Enter' && shown[active]) {
    ev.preventDefault()
    go(shown[active])
  }
})
results.on('click', (ev) => {
  const a = ev.target.closest('.search-result')
  if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
  ev.preventDefault()
  go(a)
})
// (a click on the backdrop is a click on the dialog itself)
dialog.on('click', (ev) => {
  if (ev.target === dialog.el) close()
})

const typing = (el) =>
  el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')

// (⌘K / Ctrl+K would otherwise focus the browser's own search, ex. Firefox's)
dom.onKey('k', ({ meta, ctrl, alt, shift, ev }) => {
  if (!(meta || ctrl) || alt || shift) return
  ev.preventDefault()
  dialog.el.open ? close() : open()
})
dom.onKey('/', ({ meta, ctrl, ev }) => {
  if (dialog.el.open || typing(ev.target) || meta || ctrl) return
  ev.preventDefault()
  open()
})

for (const btn of dom.els('[data-search-open]')) {
  btn.on('click', open)
  // (start loading when it's likely to open, so results are there on time)
  btn.on('pointerenter', () => load().catch(() => {}), { once: true })
}

// the shortcut hint speaks the platform's language
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
for (const kbd of dom.els('.search-kbd')) kbd.text(mac ? '⌘K' : 'Ctrl K')
