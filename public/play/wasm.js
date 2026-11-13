// Loading midnight.wasm. It's compiled once: one instance runs here, on the
// main thread, for highlighting as you type (midnightTokens), and one in the
// worker runs code (see runner.js), which gets the compiled module.
import '/play/wasm_exec.js'

// loadWasm fetches and compiles the wasm. It's shipped gzipped (see the
// Makefile) and decompressed here, so it doesn't depend on the server
// compressing it.
export const loadWasm = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const wasm = new Response(res.body.pipeThrough(new DecompressionStream('gzip')), {
    headers: { 'Content-Type': 'application/wasm' },
  })
  return WebAssembly.compileStreaming(wasm)
}

// start runs an instance of the module here, which sets the midnight* globals
export const start = async (module) => {
  const go = new Go()
  go.run(await WebAssembly.instantiate(module, go.importObject)) // (it waits forever)
}
