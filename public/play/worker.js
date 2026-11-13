// Runs code for the playground. It's a worker so a run that never ends can
// be stopped (Go in wasm can't interrupt itself): the page terminates it and
// starts a new one. The page compiles midnight.wasm once and sends the module.
importScripts('/play/wasm_exec.js')

let ready

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
  if (msg.type === 'run') {
    await ready
    const res = midnightRun(msg.src, (text) => postMessage({ type: 'out', text }))
    postMessage({ type: 'done', lua: res.lua, html: res.html, error: res.error })
  }
}
