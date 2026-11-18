# Midnight

A Lua dialect that runs on Go, for the late shift.

Midnight is Lua after hours: the same small, honest language, with braces
instead of `end`, symbols instead of keywords, and a few comforts Lua never
got around to (parameter defaults, destructuring, string interpolation,
`match`, and HTML-style markup). It runs inside Go programs, compiles to
plain Lua when it's time to ship, and with [rest](https://github.com/taybart/rest)
serves server-rendered web apps.

```midnight try
local function count_sheep(name = 'night owl', ...sheep) {
  for i, s in ipairs(sheep) {
    print("{name} counts sheep #{i}: {s}")
  }
  return match #sheep {
    0 => { 'still awake' }
    1 | 2 => { 'drowsy' }
    _ => { 'fast asleep' }
  }
}

print(count_sheep(nil, 'dolly', 'shaun', 'timmy'))
-- night owl counts sheep #1: dolly
-- night owl counts sheep #2: shaun
-- night owl counts sheep #3: timmy
-- fast asleep
```

## Two reasons to be up this late

### A more comfortable Lua

Lua is small, fast, embeddable, and a joy, right up until the fifth
`x = x or default`, the `pcall` that returns its error where the result
should be, or the `and` / `or` ternary that quietly breaks on `false`.
Midnight fixes the chores without leaving Lua: braces instead of `end`,
defaults, destructuring, interpolation, `catch`, `match`, and classes, each
compiling to the Lua you'd have written by hand. Lua modules work unchanged,
in both directions.

```midnight
local { floor } = math
local cfg = load_config(path) catch DEFAULTS
local mood = if cfg.late { 'sleepy' } else { 'awake' }
print("{cfg.name} is {mood}, {floor(cfg.hours)}h in")
```

Start with [Getting Started](/getting-started), or if Lua is already second
nature, [Coming from Lua](/from-lua) shows what you stop writing.

### Web apps without the JavaScript toolchain

Want components and JSX, but not `node_modules`, a bundler, and a JavaScript
server to run it all? HTML is part of Midnight's syntax, and
[rest](https://github.com/taybart/rest) serves it from one Go binary. Pages
render on the server, click handlers run on the server, and only the parts of
the page that changed are sent back. Think Go templates with real
components, or JSX with no build step.

```rest
# night.rest
server {
  address = "localhost:8080"

  handler "GET" "/{$}" {
    page = <<-MIDNIGHT
      local Sheep = require('sheep')
      return <html>
        <head><title>counting sheep</title></head>
        <body><Sheep owl={rest.req:query('owl') || 'night owl'}/></body>
      </html>
    MIDNIGHT
  }
}
```

```midnight
-- sheep.mn
local { state } = require('midnight.markup')

return ({ owl }) -> {
  local st = state({ count = 0 })
  local mood = match st.count {
    0 => { 'wide awake' }
    1 | 2 | 3 => { 'getting drowsy' }
    _ => { 'fast asleep' }
  }
  return <main>
    <h1>goodnight, {owl}</h1>
    <p>{st.count} sheep so far, {mood}</p>
    <button onclick={() -> { st.count += 1 }}>count another</button>
  </main>
}
```

```sh
rest -f night.rest -s
```

That's the whole app: no build, no client framework, one file to deploy
next to the binary. Components, scoped styles, and state are in
[Markup](/markup), and this site is served the same way. In fact, 
[this site runs on the stuff](https://github.com/taybart/midnight-lang.rest)

## Why Midnight

### Close to Lua

Midnight started as a fork of [Erde](https://erde-lang.github.io) and keeps
its main idea: learning Midnight should teach you Lua, and the other way
around. Every construct lowers to ordinary Lua, Midnight and Lua modules can
`require` each other, and if you ever wake up wanting plain Lua back,
`midnight compile` hands it to you.

### Runs on Go

Midnight is a fork of [gopher-lua](https://github.com/yuin/gopher-lua), a Lua
5.1 VM written in Go, with a Midnight parser in front of it. There's no
intermediate Lua source and no C: embed it in any Go program, and error line
numbers point at your Midnight source.

### Small

Midnight only adds things that most languages already have (defaults,
interpolation) or that are small and strong (destructuring, `match`). It
should still feel like Lua, just a little more comfortable at 2am.

## With thanks to Erde

Midnight wouldn't exist without [Erde](https://erde-lang.github.io), by
Brian Sutherland ([erde-lang/erde](https://github.com/erde-lang/erde)). Most of the syntax is Erde's: the braces,
the symbol operators, defaults, destructuring, arrow functions, `global` and
`module`. Erde's idea that a nicer Lua should still teach you Lua is the
whole foundation here. Midnight accepts Erde's language and is tested against
the Erde compiler's own spec suite, then adds a few things for its own night
shift (`match`, if expressions, `catch`, `const`, classes, formats, markup) and a Go runtime to run it
all on. If you want Lua with braces and don't need Go, go say hi to Erde.

## Explore

- [Getting Started](/getting-started): install, a first program, compiling,
  and embedding in Go.
- [Coming from Lua](/from-lua): what you stop writing, and the sharp edges.
- [Markup](/markup): server-rendered pages, components, styles, and state.
- [Reference](/reference): the whole language, one feature at a time.
- [Tools](/tools): `compile`, `clean`, `lint`, and `fmt`.
