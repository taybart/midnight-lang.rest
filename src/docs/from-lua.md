# Coming from Lua

Midnight keeps Lua's semantics: the same values, tables, metatables,
closures, coroutines, and standard library. Most of what you know carries
straight over. This page is the list of places where Lua muscle memory will
trip you up, usually right when you're too tired to notice.

## Cheat sheet

| Lua | Midnight |
| --- | --- |
| `if x then ... end` | `if x { ... }` |
| `while x do ... end` | `while x { ... }` |
| `repeat ... until x` | `repeat { ... } until x` |
| `function(a) return a end` | `(a) -> a` |
| `a ~= b` | `a != b` |
| `a and b or c` | `a && b \|\| c`, or `if a { b } else { c }` |
| `not a` | `!a` |
| `x = x + 1` | `x += 1` |
| `print 'hi'` | `print('hi')` |
| `('%d'):format(n)` | `'%d':format(n)` |
| `'a' .. tostring(b)` | `"a{b}"` |
| `local M = {} ... return M` | `module function f() { ... }` |
| `local x = opts.x or 1` | `local { x = 1 } = opts` |

## Not equal is !=

This is the one you'll type wrong the most. Every operator in Midnight has an
`op=` form, and `~` is xor, so `~=` already means "xor this into that":

```midnight try
local flags = 0xff
flags ~= 0x0f
print(flags)  -- 240
```

Writing `~=` where a comparison belongs fails to compile, with a hint:

```
unexpected token '~=', did you mean '!='?
```

## Symbols instead of and, or, not

`&&`, `||`, and `!` replace `and`, `or`, and `not`, with the same meaning
(they short circuit and return an operand). The old words aren't keywords
anymore, they're ordinary names, so `if not done {` is a syntax error, not a
negation.

The `a && b || c` idiom has Lua's old trap: if `b` is `nil` or `false`, you
get `c`. An [if expression](/reference#if-and-match-expressions) doesn't, and
`midnight lint` points out the risky cases.

## Calls need parentheses

Lua lets you drop the parentheses when the only argument is a string or a
table. Midnight doesn't:

```lua
-- Lua
require 'foo'
setup { verbose = true }
```

```midnight
-- Midnight
require('foo')
setup({ verbose = true })
```

## Anonymous functions are arrows

`function(...) ... end` isn't valid as an expression. Use an arrow, and `=>`
for methods that need `self` (see [Arrow functions](/reference#arrow-functions)):

```midnight
table.sort(owls, (a, b) -> a.age < b.age)
```

Named declarations (`local function f() { }`, `function obj:m() { }`) are
still written with `function`.

## Newlines settle ambiguous calls

Lua reads a `(` at the start of a line as a call on whatever came before it,
which bites when you start a line with a parenthesized expression:

```lua
local lamp = get_lamp
(lamp_fallback or noop)()   -- Lua: get_lamp(lamp_fallback or noop)()
```

Midnight treats the line break as the end of the statement, so those are two
statements, which is almost always what was meant. To chain the call, keep it
on one line. `;` still works if you want to be explicit.

## No semicolons in tables

Lua allows `;` between table fields (`{ x = 1; 'a' }`). Midnight only allows
commas, plus an optional trailing one.

## Some Lua keywords are just names

`and`, `or`, `not`, `then`, and `end` aren't keywords, so they can be
variable or field names. When compiled to Lua they're renamed (`end` becomes
`end_`) and globals become `_G["then"]`, so the output stays valid.

On the other side, Midnight reserves `continue`, `global`, and `module`.
Since `module` is a keyword, Lua 5.1's `module()` function can't be called
(it's been discouraged since Lua 5.2 anyway).

## The runtime is Lua 5.1 (plus goto)

Midnight runs on gopher-lua, which implements Lua 5.1. Code written for newer
Luas mostly works, with a few gaps to know about:

- **`goto` and labels work**, as do `continue` and `//` (floor division),
  which Midnight provides itself.
- **Bit operators** compile to the `bit32` library, which Midnight adds.
  Results are unsigned 32 bit numbers, so `~4` is `4294967291` and `-5 >> 1`
  is `2147483645`, not the signed results Lua 5.3 gives.
- **Numbers are doubles**. There's no integer subtype, `math.maxinteger`, or
  `math.type`.
- **No `utf8` library**, and it's `unpack`, not `table.unpack`.
- `string` patterns are Lua's patterns, not regular expressions.

## Running compiled Lua elsewhere

`midnight compile` and `midnight -c` produce Lua for other runtimes. The
output is valid Lua 5.1 and LuaJIT, except:

- `continue` and `goto` compile to `goto`, which needs Lua 5.2+ or LuaJIT.
- Bit operators compile to `bit32` calls, which need a `bit32` library (built
  in to Lua 5.2, otherwise use a polyfill).
- Markup compiles to calls of a factory (`h`). The `midnight.markup` runtime
  is plain Lua, so it can come along, or `-markup-factory` can point at
  another one.

Statements stay on their original lines, so errors in the compiled Lua still
report Midnight line numbers. Comments aren't kept.

## Coming from Erde

Midnight accepts the language of the
[Erde reference compiler](https://github.com/erde-lang/erde), and is tested
against its spec suite. On top of that it adds
[`match`](/reference#match),
[if and match expressions](/reference#if-and-match-expressions),
[`catch`](/reference#catch),
[interpolation formats](/reference#formats), and [markup](/markup). The other
differences:

- **No Lua targets.** There's one runtime (Lua 5.1 plus `goto`), so there are
  no target flags or target specific errors: `goto` is always allowed, and
  `break` doesn't have to be the last statement in a block.
- **Bit operators** always use `bit32`, with no `--bitlib` flag.
- **Error line numbers** point at the Midnight source directly, with no
  source maps or error rewriting.
- **Operator assignment evaluates index chains once.** `t[f()] += 1` calls
  `f` once (Erde calls it twice).
