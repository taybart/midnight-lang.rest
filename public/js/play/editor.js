// The editor: a transparent <textarea> laid over a highlighted copy of its
// text, withline numbers beside it (see src/playground.midnight). Lines can be
// marked (ex. withthe linter's problems): hovering one, or tapping its number,
// shows what's wrong. What you type is saved, so it's there next visit.
import { dom, ls } from '@taybart/corvid'
import { highlight } from '/js/play/highlight.js'

const STORAGE_KEY = 'playground:code'

// saved is the code from last visit, if any. (localStorage can throw, ex. with
// site data blocked; the playground works without it.)
export const saved = () => {
  try {
    return ls.get(STORAGE_KEY)
  } catch (e) {
    return null
  }
}
const save = (code) => {
  try {
    ls.set(STORAGE_KEY, code)
  } catch (e) {}
}

export class Editor {
  #input
  #highlight
  #lines
  #markLayer
  #tip
  #marks = new Map() // line -> { kind: 'warn' | 'err', message, rule? }
  #onChange
  #saveTimer

  /**
   * input, highlight, lines, marks and tip are queries. onRun is called for
   * ctrl / cmd + enter, onFormat for shift + alt + f, and onChange(code) as
   * you type.
   */
  constructor({ input, highlight, lines, marks, tip, onRun, onFormat, onChange }) {
    this.#input = new dom.el(input)
    this.#highlight = new dom.el(highlight)
    this.#lines = new dom.el(lines)
    this.#markLayer = new dom.el(marks)
    this.#tip = new dom.el(tip)
    this.#onChange = onChange

    // the tip: hover a marked line (or its number), or tap its number
    const gutter = new dom.el(this.#lines.el.parentElement)
    this.#input.on('mousemove', (e) => this.#tipAt(e))
    gutter.on('mousemove', (e) => this.#tipAt(e)).on('click', (e) => this.#tipAt(e))
    for (const el of [this.#input, gutter]) el.on('mouseleave', () => this.#hideTip())

    this.#input
      .on('input', () => this.#changed())
      .on('scroll', () => {
        this.#syncScroll()
        this.#hideTip()
      })
      .on('keydown', (e) => {
        this.#hideTip()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          onRun()
        } else if (e.code === 'KeyF' && e.shiftKey && e.altKey) {
          // (e.code: withalt, e.key is a different letter on a mac)
          e.preventDefault()
          onFormat()
        } else if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          this.#insert('  ')
        }
      })
  }

  value() {
    return this.#input.value()
  }

  set(code) {
    this.#input.value(code)
    this.#input.el.scrollTop = 0
    this.#changed()
  }

  // replace swaps in new code (ex. formatted) as an edit, so it can be undone,
  // and keeps the cursor on the same line
  replace(code) {
    const ta = this.#input.el
    const line = this.#lineAt(ta.selectionStart)
    ta.focus()
    ta.select()
    this.#insert(code)
    const start = lineStart(code, line)
    ta.setSelectionRange(start, start)
  }

  // refresh highlights again (ex. once the lexer has loaded)
  refresh() {
    this.#highlight.html(highlight(this.value()))
    this.#renderLines()
  }

  // mark marks lines: [{ line, kind: 'warn' | 'err', message, rule? }]
  mark(marks) {
    this.#marks = new Map()
    for (const m of marks) {
      // (an error outranks a warning on the same line)
      if (this.#marks.get(m.line)?.kind !== 'err') this.#marks.set(m.line, m)
    }
    this.#renderLines()
    this.#renderMarks()
  }

  focus() {
    this.#input.el.focus()
  }

  blur() {
    this.#input.el.blur()
  }

  #changed() {
    this.refresh()
    this.#syncScroll()
    this.#onChange?.(this.value())
    clearTimeout(this.#saveTimer)
    this.#saveTimer = setTimeout(() => save(this.value()), 300)
  }

  #renderLines() {
    const count = this.value().split('\n').length
    const frag = document.createDocumentFragment()
    for (let i = 1; i <= count; i++) {
      const n = dom.create({ tag: 'span', text: String(i) })
      const mark = this.#marks.get(i)
      if (mark) n.className = mark.kind
      frag.append(n)
    }
    this.#lines.html(frag)
  }

  // renderMarks tints the marked lines, behind the code
  #renderMarks() {
    const frag = document.createDocumentFragment()
    for (const [line, mark] of this.#marks) {
      const bar = dom.create({ tag: 'span', class: mark.kind })
      bar.style.top = `${(line - 1) * 1.5}em` // (the line height, see site.css)
      frag.append(bar)
    }
    this.#markLayer.html(frag)
  }

  // tipAt shows what's wrong withthe marked line under the pointer, if any
  #tipAt(e) {
    const ta = this.#input.el
    const style = getComputedStyle(ta)
    const lineHeight = parseFloat(style.lineHeight)
    const top = ta.getBoundingClientRect().top + parseFloat(style.paddingTop)
    const line = Math.floor((e.clientY - top + ta.scrollTop) / lineHeight) + 1
    const mark = this.#marks.get(line)
    if (!mark) {
      this.#hideTip()
      return
    }
    const editor = ta.parentElement.getBoundingClientRect()
    this.#tip.text(mark.message)
    if (mark.rule) this.#tip.append(dom.create({ tag: 'span', class: 'rule', text: mark.rule }))
    this.#tip.el.className = `pg-tip ${mark.kind}`
    this.#tip.el.hidden = false
    // (below the line, near the pointer, inside the editor)
    const width = this.#tip.el.offsetWidth
    const x = Math.min(e.clientX - editor.left, editor.width - width - 8)
    this.#tip.style({
      left: `${Math.max(8, x)}px`,
      top: `${top - editor.top + line * lineHeight - ta.scrollTop + 4}px`,
    })
  }

  #hideTip() {
    this.#tip.el.hidden = true
  }

  // the highlighted copy and the line numbers scroll withthe textarea
  #syncScroll() {
    const ta = this.#input.el
    const pre = this.#highlight.el.parentElement
    pre.scrollTop = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
    this.#lines.el.parentElement.scrollTop = ta.scrollTop
    this.#markLayer.el.style.transform = `translateY(${-ta.scrollTop}px)`
  }

  // insert types text at the cursor (over the selection)
  #insert(text) {
    // (execCommand keeps the browser's undo history, setRangeText doesn't)
    if (document.execCommand('insertText', false, text)) return
    const ta = this.#input.el
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end')
    this.#changed()
  }

  #lineAt(offset) {
    return this.value().slice(0, offset).split('\n').length
  }
}

// lineStart is the offset where line (from 1) starts in code, or its end
const lineStart = (code, line) => {
  let at = 0
  for (let i = 1; i < line; i++) {
    const next = code.indexOf('\n', at)
    if (next < 0) return code.length
    at = next + 1
  }
  return at
}
