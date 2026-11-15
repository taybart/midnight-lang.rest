// Running code, in a worker (see worker.js). Go in wasm can't interrupt
// itself, so a run (or a page action) that never ends is stopped by
// terminating the worker and starting a new one.
//
// An interactive page's state lives in the worker between clicks, so it
// goes withthe worker when it's stopped (or when the code runs again).

export const TIMEOUT_MS = 5000

// cleanError keeps the traceback frames in the user's code (the rest are
// the runtime and the playground calling in, which says nothing useful)
export const cleanError = (error) => {
  const [message, trace] = error.split('\nstack traceback:\n')
  if (trace === undefined) return error.trimEnd()
  const frames = trace.split('\n').filter((l) => l.includes('playground.mn:'))
  return (frames.length ? `${message}\nstack traceback:\n${frames.join('\n')}` : message).trimEnd()
}

export class Runner {
  // whether the worker holds the shown page's state (so its actions can run)
  pageLive = false

  #module
  #on
  #worker
  #run = null // the run in progress: { started, timer, wrote }
  #action = null // the page action in progress: { started, timer }

  /**
   * module is the compiled midnight.wasm. on has the callbacks:
   *   output(text)              what the code printed, as it prints it
   *   done(res, { ms, wrote })  a run finished: { lua, html, interactive, error }
   *   dispatched(res, { ms })   an action finished: { req, html, error }
   *   stopped(why)              a run or action timed out
   */
  constructor(module, on) {
    this.#module = module
    this.#on = on
    this.#start()
  }

  get busy() {
    return !!(this.#run || this.#action)
  }

  // run runs src, stopping whatever's running first
  run(src) {
    if (this.busy) this.#restart()
    this.pageLive = false
    this.#run = { started: performance.now(), wrote: false, timer: this.#timeout('the code is') }
    this.#worker.postMessage({ type: 'run', src })
  }

  // dispatch runs an action of the live page (ex. a click). It's false if
  // there's no live page to run it, or code is running.
  dispatch(req, action, data) {
    if (!this.pageLive || this.#run) return false
    this.#action = { started: performance.now(), timer: this.#timeout('an action is') }
    this.#worker.postMessage({ type: 'dispatch', req, action, data })
    return true
  }

  #start() {
    this.#worker = new Worker('/js/play/worker.js')
    this.#worker.postMessage({ type: 'init', module: this.#module })
    this.#worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'out') {
        if (this.#run) this.#run.wrote = true
        this.#on.output(msg.text)
      } else if (msg.type === 'done' && this.#run) {
        const { started, wrote } = this.#finish('run')
        this.pageLive = !!msg.interactive
        this.#on.done(msg, { ms: since(started), wrote })
      } else if (msg.type === 'dispatched' && this.#action) {
        const { started } = this.#finish('action')
        this.#on.dispatched(msg, { ms: since(started) })
      }
    }
  }

  // finish clears the job (run or action) and returns it
  #finish(kind) {
    const job = kind === 'run' ? this.#run : this.#action
    clearTimeout(job.timer)
    if (kind === 'run') this.#run = null
    else this.#action = null
    return job
  }

  // restart ends whatever is running by replacing the worker
  #restart() {
    for (const job of [this.#run, this.#action]) if (job) clearTimeout(job.timer)
    this.#run = this.#action = null
    this.pageLive = false
    this.#worker.terminate()
    this.#start()
  }

  #timeout(what) {
    return setTimeout(() => {
      this.#restart()
      this.#on.stopped(
        `stopped: ${what} still running after ${TIMEOUT_MS / 1000}s (a loop that never ends?)`,
      )
    }, TIMEOUT_MS)
  }
}

const since = (started) => Math.round(performance.now() - started)
