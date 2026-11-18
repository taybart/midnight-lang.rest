# Getting Started

## Install

Midnight ships as a Go library and a `midnight` CLI:

```sh copy
go get github.com/taybart/midnight
go install github.com/taybart/midnight/cmd/midnight@latest
```

Check that it's awake:

```sh
midnight -e 'print("hello from {_VERSION}")'
```

## Run a script

Files use `.mn` (or `.midnight`). Scripts that don't end in `.lua` run as
Midnight (use `-lang lua` or `-lang midnight` to override).

```sh
midnight hello.mn            # run a file
cat hello.mn | midnight -    # read from stdin
midnight hello.lua           # .lua files run as Lua
midnight                     # the REPL
```

A first script, `hello.mn`:

```midnight try
local function goodnight(who = 'moon') {
  print("goodnight, {who}")
}

for _, who in ipairs({ 'room', 'moon', 'cow jumping over the moon' }) {
  goodnight(who)
}
```

## Your first program

Let's build something a bit bigger: a sleep log that reports how you're
doing. It only uses the everyday parts of Midnight, the ones you'll use in
every file. (Every example with a **Try it** button runs in the
[playground](/playground).)

### Functions and loops

Blocks are braces, and that's most of the difference from Lua:

```midnight try
local nights = { 7.5, 6, 8, 4.5, 7 }

local function average(list) {
  local sum = 0
  for _, n in ipairs(list) {
    sum += n
  }
  return sum / #list
}

print(average(nights)) -- 6.6
```

There's no `then`, `do`, or `end`, and `sum += n` saves writing `sum` twice.
Everything else (`local`, `ipairs`, `#list`) is plain Lua.

### Defaults and interpolation

A parameter can have a default, used when the argument is `nil`. Double
quoted strings fill in `{expressions}`, and `{value:%.1f}` formats one like
`string.format`:

```midnight try
local function report(hours, goal = 8) {
  local short = goal - hours
  if short > 0 {
    return "{hours:%.1f}h a night, {short:%.1f}h short of {goal}"
  }
  return "{hours:%.1f}h a night, goal met"
}

print(report(6.6))     -- 6.6h a night, 1.4h short of 8
print(report(6.6, 6))  -- 6.6h a night, goal met
```

Single quoted strings don't interpolate, so `'{this}'` stays as written.

### Tables, arrows, and destructuring

Anonymous functions are arrows, and `local { a, b } = t` (or a loop
variable written the same way) pulls fields out of a table:

```midnight try
local log = {
  { day = 'mon', hours = 7.5 },
  { day = 'tue', hours = 6 },
  { day = 'wed', hours = 8 },
  { day = 'thu', hours = 4.5 },
}

table.sort(log, (a, b) -> a.hours > b.hours)

for i, { day, hours } in ipairs(log) {
  print("{i}. {day}: {hours}h")
}
```

### Split it into modules

`module` exports a name. A file with `module` declarations returns them as a
table, so there's no `local M = {} ... return M`:

```midnight
-- sleep.mn
module function average(list) {
  local sum = 0
  for _, n in ipairs(list) { sum += n }
  return sum / #list
}

module function report(hours, goal = 8) {
  local short = goal - hours
  if short > 0 {
    return "{hours:%.1f}h a night, {short:%.1f}h short of {goal}"
  }
  return "{hours:%.1f}h a night, goal met"
}
```

```midnight
-- main.mn
local { average, report } = require('sleep')

local log = {
  { day = 'mon', hours = 7.5 },
  { day = 'tue', hours = 6 },
  { day = 'wed', hours = 8 },
  { day = 'thu', hours = 4.5 },
}

local hours = {}
for _, night in ipairs(log) {
  hours[#hours + 1] = night.hours
}

print(report(average(hours)))
```

```sh
midnight main.mn   # 6.5h a night, 1.5h short of 8
```

`require('sleep')` finds `sleep.mn` as well as `sleep.lua`, and Midnight and
Lua modules can require each other freely, since both compile to the same
bytecode.

### Where next

That's enough Midnight to write real programs. From here:

- **You know Lua well:** [Coming from Lua](/from-lua) is the short version,
  what Midnight saves you from writing, and what will trip you up.
- **You want to build a web app:** [Markup](/markup) is HTML in the language,
  rendered on the server, with interactive pages and no JavaScript toolchain.
- **You want everything:** the [Reference](/reference) covers the whole
  language, including `match`, `catch`, `const`, and classes.

## Compile

When it's time to ship to a plain Lua runtime, compile to Lua:

```sh
midnight compile .            # foo.mn -> foo.lua (in place)
midnight compile src -o out   # ... under out/, keeping paths
midnight -c script.mn         # print the compiled Lua
midnight clean .              # remove generated .lua files
```

The output is ordinary Lua 5.1 with two exceptions: `continue` and `goto`
need Lua 5.2+ or LuaJIT, and bit operators need a `bit32` library. Statements
stay on their original lines, so errors in the compiled Lua report Midnight
line numbers. See [Coming from Lua](/from-lua#running-compiled-lua-elsewhere).

## Embed in Go

The Go package is still named `lua`, since it's still a Lua VM. Everything
from gopher-lua works the same way, plus Midnight versions of the loaders:

```go
import lua "github.com/taybart/midnight"

L := lua.NewState()
defer L.Close()

// Midnight versions of DoString / LoadString / Load
L.DoMidnightString(`print("hello {_VERSION}")`)
fn, err := L.LoadMidnightString(source)
fn, err := L.LoadMidnight(reader, "name.mn")

// *.mn files load as Midnight, and `require` finds ?.mn modules
L.DoFile("script.mn")
```

Going lower, the parser produces the same AST as gopher-lua's Lua parser:

```go
import (
	"github.com/taybart/midnight/luagen"
	"github.com/taybart/midnight/parse"
)

chunk, err := parse.ParseMidnight(reader, "name.mn")
proto, err := lua.Compile(chunk, "name.mn")
source := luagen.Generate(chunk) // Lua source
```

## The CLI

| Command | Does |
| --- | --- |
| `midnight script.mn` | run a script |
| `midnight -e 'code'` | run a string |
| `midnight -c script.mn` | print the compiled Lua |
| `midnight compile` | compile `.mn` to `.lua` |
| `midnight clean` | remove generated `.lua` files |
| `midnight lint` | check for likely mistakes |
| `midnight fmt` | format `.mn` files |

See `midnight -h` for every flag, and [Tools](/tools) for `compile`, `lint`,
and `fmt` in detail.

## Editors

- **Neovim**: [midnight.nvim](https://github.com/taybart/midnight.nvim) adds
  the filetype, tree-sitter highlighting, `midnight fmt` formatting,
  `midnight lint` diagnostics, and `:MidnightCompile` to watch the Lua a
  buffer compiles to. It also understands Midnight inside `.rest` files.
- **Anything with tree-sitter**:
  [tree-sitter-midnight](https://github.com/taybart/tree-sitter-midnight).

[Next: coming from Lua](/from-lua)
