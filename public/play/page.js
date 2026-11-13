// The Page tab: markup the code returns, rendered in a sandboxed iframe, w/
// its clicks (and other actions) working.
//
// A page's client script POSTs each action to its server. In the iframe, the
// bridge answers those requests instead: it hands them to the playground
// (postMessage), which runs them in the worker, where the page's state
// lives, and sends back what changed. The iframe is sandboxed w/o
// allow-same-origin, so it can only talk to us through messages.
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
})()</script>`

// withBridge puts the bridge first, so it's there before the page's scripts
const withBridge = (html) => html.replace(/^(<!DOCTYPE html>)?/i, (doctype) => doctype + BRIDGE)

export class PageFrame {
  #frame

  /**
   * frame is the iframe (a query). onAction({ req, action, data }) is called
   * for each action the page sends; answer it w/ reply(req, ...).
   */
  constructor(frame, onAction) {
    this.#frame = new dom.el(frame)
    dom.onWindow('message', (e) => {
      const msg = e.data
      if (e.source !== this.#frame.el.contentWindow || msg?.type !== 'midnight:rpc') return
      onAction(msg)
    })
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
