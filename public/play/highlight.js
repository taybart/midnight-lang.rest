// Highlighting for the editor, colored by the compiler's own lexer
// (midnightTokens, from the wasm instance on the main thread, see wasm.js).
import { dom } from '/js/corvid.bundle.js'

// token kinds from the compiler's lexer -> the docs' classes (see lib/highlight.mn)
// biome-ignore format: a table
const CLASS = {
  keyword: 'tok-keyword', constant: 'tok-const', number: 'tok-number',
  string: 'tok-string', interp: 'tok-interp', format: 'tok-interp',
  comment: 'tok-comment', markup: 'tok-punct', tag: 'tok-tag', attr: 'tok-attr',
}
// biome-ignore format: a table
const BUILTIN = new Set([
  'print', 'require', 'type', 'tostring', 'tonumber', 'pairs', 'ipairs', 'next',
  'select', 'error', 'assert', 'pcall', 'xpcall', 'setmetatable', 'getmetatable',
  'rawget', 'rawset', 'rawequal', 'unpack', 'string', 'table', 'math', 'io', 'os',
  'coroutine',
])
const PUNCT = new Set(['(', ')', '[', ']', ';', ':', ',', '.', '{', '}'])

// the token after i, skipping whitespace
const nextToken = (toks, i) => {
  let t = toks[i + 1]
  if (t && t[0] === 'plain' && !t[1].trim()) t = toks[i + 2]
  return t
}

// (text, not content: this is the user's code, '<' and all)
const span = (cls, s) => dom.create({ tag: 'span', class: cls, text: s })

// highlight returns src as highlighted nodes (plain text until the wasm loads)
export const highlight = (src) => {
  // (a trailing newline needs a character after it to take up a line)
  if (!window.midnightTokens) return document.createTextNode(`${src} `)

  const toks = midnightTokens(src)
  const frag = document.createDocumentFragment()
  toks.forEach(([kind, s], i) => {
    let cls = CLASS[kind]
    if (kind === 'word') {
      const next = nextToken(toks, i)
      if (BUILTIN.has(s)) cls = 'tok-builtin'
      else if (s === 'match' && next && next[0] !== 'symbol') cls = 'tok-keyword'
      else if (next && next[0] === 'symbol' && next[1] === '(') cls = 'tok-function'
    } else if (kind === 'symbol') {
      cls = PUNCT.has(s) ? 'tok-punct' : 'tok-operator'
    }
    frag.append(cls ? span(cls, s) : s)
  })
  frag.append(' ')
  return frag
}
