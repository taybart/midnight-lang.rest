# Midnight

A Lua dialect that runs on Go.

Midnight is a more convenient [Lua](https://www.lua.org): a symbol-favored
syntax that maps closely to Lua, plus `match`, `if`/`match` expressions, string
interpolation, and JSX-style markup. It runs in Go programs, or compiles to
plain Lua.

```midnight
local function sum_evens(...numbers) {
  local sum = 0
  for _, n in ipairs(numbers) {
    if n % 2 == 0 { sum += n }
  }
  return sum
}

print(sum_evens(1, 2, 3, 4, 5)) -- 6
```

Midnight started as a fork of [Erde](https://erde-lang.github.io), and is a
fork of [gopher-lua](https://github.com/yuin/gopher-lua) (a Lua 5.1 VM in Go)
with a Midnight parser. Source files use `.mn` (or `.midnight`).

## Install

```sh
go get github.com/taybart/midnight
go install github.com/taybart/midnight/cmd/midnight@latest  # the CLI
```

## Quick start

```sh
midnight hello.mn            # run a script
midnight compile .           # foo.mn -> foo.lua
midnight -e 'print("{1 + 1}")'
```

## Explore

- [Getting Started](/getting-started) — install, run, compile.
- [Reference](/reference) — the language: syntax, operators, and constructors.
