// Linting. The linter is the compiler's (midnightLint, `midnight lint`, from
// the wasm instance on the main thread, see wasm.js). Its problems mark their
// lines in the editor.

// lint returns src's problems: [{ line, message, rule, kind: 'warn' | 'err' }]
// (a syntax error is an err, the rest are warnings)
export const lint = (src) => {
  if (!window.midnightLint) return []
  const res = midnightLint(src)
  if (!Array.isArray(res)) return [] // ({ error }: the linter itself failed)
  return res.map(([line, message, rule]) => ({
    line,
    message,
    rule,
    kind: rule === 'syntax' ? 'err' : 'warn',
  }))
}
