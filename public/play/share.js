// Share links: the code, deflated and base64url encoded, in the url's hash
// (#code=...). The hash never reaches the server.

const toB64url = (bytes) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromB64url = (str) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

const pipe = (data, transform) =>
  new Response(new Blob([data]).stream().pipeThrough(transform))

export async function encode(src) {
  const res = pipe(src, new CompressionStream('deflate-raw'))
  return toB64url(new Uint8Array(await res.arrayBuffer()))
}

export async function decode(str) {
  return pipe(fromB64url(str), new DecompressionStream('deflate-raw')).text()
}

export async function playgroundUrl(src) {
  return `/playground#code=${await encode(src)}`
}
