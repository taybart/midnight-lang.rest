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

// Lua (the Lua tab: what the code compiles to). The compiler's lexer is
// midnight's, so this is a small one of its own.

// biome-ignore format: a table
const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'for', 'function', 'goto', 'if',
  'in', 'local', 'not', 'or', 'repeat', 'return', 'then', 'until', 'while',
])
const LUA_CONSTANTS = new Set(['true', 'false', 'nil'])

// one token per match, by its group: comment, string, number, name, operator,
// punctuation (anything else, ex. whitespace, is between matches)
const LUA_TOKEN = new RegExp(
  [
    /(--\[(=*)\[[\s\S]*?\]\2\]|--[^\n]*)/, // 1: comment (2: its =s)
    /(\[(=*)\[[\s\S]*?\]\4\]|"(?:\\[\s\S]|[^"\\\n])*"?|'(?:\\[\s\S]|[^'\\\n])*'?)/, // 3: string (4)
    /(0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/, // 5: number
    /([A-Za-z_]\w*)/, // 6: name
    /(==|~=|<=|>=|\.\.\.?|::|[-+*/%^#<>=])/, // 7: operator
    /([()[\]{};:,.])/, // 8: punctuation
  ]
    .map((r) => r.source)
    .join('|'),
  'g',
)

// highlightLua returns Lua source as highlighted nodes
export const highlightLua = (src) => {
  const frag = document.createDocumentFragment()
  let at = 0
  for (const m of src.matchAll(LUA_TOKEN)) {
    if (m.index > at) frag.append(src.slice(at, m.index))
    const [text, comment, , string, , number, name, operator] = m
    let cls = 'tok-punct'
    if (comment) cls = 'tok-comment'
    else if (string) cls = 'tok-string'
    else if (number) cls = 'tok-number'
    else if (operator) cls = 'tok-operator'
    else if (name) {
      if (LUA_KEYWORDS.has(name)) cls = 'tok-keyword'
      else if (LUA_CONSTANTS.has(name)) cls = 'tok-const'
      else if (BUILTIN.has(name)) cls = 'tok-builtin'
      else if (/^\s*[(]/.test(src.slice(m.index + text.length))) cls = 'tok-function'
      else cls = null
    }
    frag.append(cls ? span(cls, text) : text)
    at = m.index + text.length
  }
  frag.append(src.slice(at))
  return frag
}
