// The Page tab: markup the code returns, rendered in a sandboxed iframe, w/
// its clicks (and other actions) working.
//
// A page's client script POSTs each action to its server. In the iframe, the
// bridge answers those requests instead: it hands them to the playground
// (postMessage), which runs them in the worker, where the page's state
// lives, and sends back what changed. The iframe is sandboxed w/o
// allow-same-origin, so it can only talk to us through messages.
//
// The bridge also reports the page's height. On phones the iframe is made that
// tall, so the page scrolls w/ the playground: an iframe that scrolls on its
// own is hard to use on a phone (iOS won't scroll it until it's been tapped).
import { dom } from '/js/corvid.bundle.js'

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

  // the page's height, from its content, not the body's: a body w/
  // min-height: 100vh is as tall as the iframe, so it'd grow w/ it forever
  let last = 0
  const report = () => {
    const body = document.body
    if (!body) return
    let bottom = 0
    for (const el of body.children) {
      const margin = parseFloat(getComputedStyle(el).marginBottom) || 0
      bottom = Math.max(bottom, el.getBoundingClientRect().bottom + margin)
    }
    const style = getComputedStyle(body)
    const height = Math.ceil(
      bottom + scrollY + parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth) +
        parseFloat(style.marginBottom),
    )
    if (height === last) return
    last = height
    parent.postMessage({ type: 'midnight:size', height }, '*')
  }
  addEventListener('load', report)
  addEventListener('resize', report)
  // (an action changes the page)
  new MutationObserver(report).observe(document, {
    subtree: true, childList: true, attributes: true, characterData: true,
  })
})()</script>`

// withBridge puts the bridge first, so it's there before the page's scripts
const withBridge = (html) => html.replace(/^(<!DOCTYPE html>)?/i, (doctype) => doctype + BRIDGE)

// on phones (the playground stacked), the iframe is as tall as its page
const stacked = window.matchMedia('(max-width: 900px)')

export class PageFrame {
  #frame
  #height = 0 // the page's, as the bridge last said

  /**
   * frame is the iframe (a query). onAction({ req, action, data }) is called
   * for each action the page sends; answer it w/ reply(req, ...).
   */
  constructor(frame, onAction) {
    this.#frame = new dom.el(frame)
    dom.onWindow('message', (e) => {
      const msg = e.data
      if (e.source !== this.#frame.el.contentWindow) return
      if (msg?.type === 'midnight:rpc') onAction(msg)
      else if (msg?.type === 'midnight:size') {
        this.#height = msg.height
        this.#fit()
      }
    })
    stacked.addEventListener('change', () => this.#fit())
  }

  // fit makes the iframe as tall as its page, on phones (and back, on desktop:
  // there it fills its pane, and scrolls)
  #fit() {
    this.#frame.style({ height: stacked.matches && this.#height ? `${this.#height}px` : '' })
  }

  // show renders html (or empties the frame, w/o it). It's a new iframe each
  // time: reusing one (ex. setting srcdoc again, often to the same html, and
  // while its tab is hidden) can leave it blank in some browsers. It's hidden
  // until it loads, since an iframe is white while it loads.
  show(html) {
    const fresh = new dom.el(this.#frame.el.cloneNode(false))
    fresh.style({ visibility: 'hidden' })
    fresh.on('load', () => fresh.style({ visibility: '' }), { once: true })
    fresh.el.srcdoc = html ? withBridge(html) : ''
    this.#frame.el.replaceWith(fresh.el)
    this.#frame = fresh
  }

  // reply answers an action w/ what changed (html) or an error
  reply(req, { html, error }) {
    this.#frame.el.contentWindow?.postMessage(
      { type: 'midnight:rpc-result', req, html, error },
      '*',
    )
  }
}
