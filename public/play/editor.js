// The editor: a transparent <textarea> laid over a highlighted copy of its
// text (see src/playground.midnight). What you type is saved, so it's there
// next visit.
import { dom, ls } from '/js/corvid.bundle.js'
import { highlight } from '/play/highlight.js'

const STORAGE_KEY = 'playground:code'

// saved is the code from last visit, if any. (localStorage can throw, ex. w/
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
  #saveTimer

  // onRun is called for ctrl / cmd + enter
  constructor({ input, highlight, onRun }) {
    this.#input = new dom.el(input)
    this.#highlight = new dom.el(highlight)
    this.#input
      .on('input', () => this.#changed())
      .on('scroll', () => this.#syncScroll())
      .on('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          onRun()
        } else if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          this.#indent()
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

  // refresh highlights again (ex. once the lexer has loaded)
  refresh() {
    this.#highlight.html(highlight(this.value()))
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
    clearTimeout(this.#saveTimer)
    this.#saveTimer = setTimeout(() => save(this.value()), 300)
  }

  // the highlighted copy scrolls with the textarea
  #syncScroll() {
    const pre = this.#highlight.el.parentElement
    pre.scrollTop = this.#input.el.scrollTop
    pre.scrollLeft = this.#input.el.scrollLeft
  }

  // Tab indents (two spaces) instead of leaving the editor
  #indent() {
    // (execCommand keeps the browser's undo history, setRangeText doesn't)
    if (document.execCommand('insertText', false, '  ')) return
    const ta = this.#input.el
    ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end')
    this.#changed()
  }
}
