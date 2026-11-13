// Loading midnight.wasm. It's compiled once: one instance runs here, on the
// main thread, for highlighting as you type (midnightTokens), and one in the
// worker runs code (see runner.js), which gets the compiled module.
import '/js/vendor/wasm_exec.js'

// loadWasm fetches and compiles the wasm, compiling as it downloads. rest
// sends it compressed ahead of time (midnight.wasm.br or .gz, see the
// Makefile), and the browser decompresses it.
export const loadWasm = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return WebAssembly.compileStreaming(res)
}

// start runs an instance of the module here, which sets the midnight* globals
export const start = async (module) => {
  const go = new Go()
  go.run(await WebAssembly.instantiate(module, go.importObject)) // (it waits forever)
}
