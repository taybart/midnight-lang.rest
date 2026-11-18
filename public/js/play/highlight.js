// Highlighting for the editor and the Lua tab, by the compiler
// (midnightHighlight, from the wasm instance on the main thread, see wasm.js):
// the same classes as the docs' code blocks (lib/highlight.mn), from the same
// rules (parse.HighlightCode in midnight).
import { dom } from '@taybart/corvid'

// (text, not content: this is the user's code, '<' and all)
const span = (cls, s) => dom.create({ tag: 'span', class: cls, text: s })

// colorize returns src (in lang: 'midnight' or 'lua') as highlighted nodes,
// or null until the wasm has loaded
const colorize = (src, lang) => {
  const toks = window.midnightHighlight?.(src, lang)
  if (!toks) return null
  const frag = document.createDocumentFragment()
  for (const [cls, s] of toks) frag.append(cls ? span(`tok-${cls}`, s) : s)
  return frag
}

// highlight returns midnight source as highlighted nodes (plain text until
// the wasm loads)
export const highlight = (src) => {
  const frag = colorize(src, 'midnight') ?? document.createDocumentFragment()
  if (!frag.hasChildNodes()) frag.append(src)
  // (a trailing newline needs a character after it to take up a line)
  frag.append(' ')
  return frag
}

// highlightLua returns Lua source (the Lua tab: what the code compiles to) as
// highlighted nodes
export const highlightLua = (src) => colorize(src, 'lua') ?? document.createTextNode(src)
