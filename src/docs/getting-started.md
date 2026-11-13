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

```midnight
local function goodnight(who = 'moon') {
  print("goodnight, {who}")
}

for _, who in ipairs({ 'room', 'moon', 'cow jumping over the moon' }) {
  goodnight(who)
}
```

## Modules

`require('name')` finds `name.mn` as well as `name.lua`, and Midnight and Lua
modules can require each other freely, since both compile to the same
bytecode. Export with `module` (see [Scopes](/reference#scopes)):

```midnight
-- dreams.mn
module function recall(n = 1) {
  return "you remember {n} dream(s)"
}
```

```midnight
-- main.mn
local { recall } = require('dreams')
print(recall(2)) -- you remember 2 dream(s)
```

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

[Next: the language reference](/reference)
