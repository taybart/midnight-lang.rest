// Runs code for the playground. It's a worker so a run that never ends can
// be stopped (Go in wasm can't interrupt itself): the page terminates it and
// starts a new one. The page compiles midnight.wasm once and sends the module.
//
// An interactive page's state lives here between clicks: the page sends each
// action as a `dispatch`, and gets back what changed.
importScripts('/play/wasm_exec.js')

let ready

const output = (text) => postMessage({ type: 'out', text })

onmessage = async (e) => {
  const msg = e.data
  if (msg.type === 'init') {
    ready = (async () => {
      const go = new Go()
      const inst = await WebAssembly.instantiate(msg.module, go.importObject)
      go.run(inst) // (sets the midnight* globals, then waits forever)
    })()
    return
  }
  await ready
  if (msg.type === 'run') {
    const res = midnightRun(msg.src, output)
    postMessage({
      type: 'done',
      lua: res.lua,
      html: res.html,
      interactive: !!res.interactive,
      error: res.error,
    })
  } else if (msg.type === 'dispatch') {
    const res = midnightDispatch(msg.action, msg.data ?? {}, output)
    postMessage({ type: 'dispatched', req: msg.req, html: res.html, error: res.error })
  }
}
