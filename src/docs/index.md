# Midnight

A Lua dialect that runs on Go, for the late shift.

Midnight is Lua after hours: the same small, honest language, with braces
instead of `end`, symbols instead of keywords, and a few comforts Lua never
got around to (parameter defaults, destructuring, string interpolation,
`match`, and HTML-style markup). It runs inside Go programs, or compiles to
plain Lua when it's time to ship.

```midnight
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

## A quick tour

If you know Lua, you already know most of Midnight. Here's what's new.

### Braces and symbols

Blocks use `{ }`. Logic uses `&&`, `||`, and `!`, and "not equal" is `!=`.
Every binary operator has an assignment form.

```midnight
local stars = 0
while stars < 3 && !dawn {
  stars += 1
}
```

### Defaults, varargs, and arrows

Any parameter can have a default, varargs can have a name, and anonymous
functions are arrows.

```midnight
local function dream(about = 'electric sheep', ...details) {
  return "dreaming of {about} ({#details} details)"
}

local yawn = (n) -> string.rep('a', n)
print("y{yawn(5)}wn") -- yaaaaawn
```

### Interpolation

Double quoted and block strings interpolate `{expressions}`, and
`{expr:%spec}` formats them with `string.format`.

```midnight
local hours = 7.5
print("slept {hours:%.1f} hours") -- slept 7.5 hours
print('single quotes stay {literal}') -- single quotes stay {literal}
```

### Destructuring

```midnight
local { moon, stars = 0 } = sky
local [ first, second ] = { 'dusk', 'dark' }
```

### match, and if as a value

```midnight
local greeting = if hour < 5 { 'go back to bed' } else { 'good morning' }

local phase = match day % 28 {
  0 => { 'new moon' }
  14 => { 'full moon' }
  _ => { 'somewhere in between' }
}
```

### Markup

HTML is part of the language. Elements compile to plain function calls, and
the `midnight.markup` runtime renders them, with components, scoped styles,
and interactive pages.

```midnight
local Moon = ({ phase }) -> <span class="moon">{phase}</span>

return <p>tonight's moon: <Moon phase="waxing"/></p>
```

## Serve it with rest

[rest](https://github.com/taybart/rest) is the other half of the stack: an
HTTP client, mock server, and page server driven by `.rest` files. Its `page`
handlers run Midnight on the server and keep each visitor's state between
clicks, so this is a complete interactive app:

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

The click handler runs on the server, and only the parts of the page that
changed are sent back. This site is served the same way.

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
shift (`match`, if expressions, formats, markup) and a Go runtime to run it
all on. If you want Lua with braces and don't need Go, go say hi to Erde.

## Explore

- [Getting Started](/getting-started): install, run, compile, and embed in Go.
- [Reference](/reference): the whole language, one feature at a time.
- [Coming from Lua](/from-lua): what's different, and the sharp edges.
- [Markup](/markup): elements, components, styles, and interactive pages.
- [Tools](/tools): `compile`, `clean`, `lint`, and `fmt`.
