# Coming from Lua

Midnight keeps Lua's semantics: the same values, tables, metatables,
closures, coroutines, and standard library. Everything you know carries
straight over, and everything you write still becomes plain Lua. This page
has two halves:

- [What you get](#what-you-get): the chores Lua makes you do by hand, and
  the bugs that come with them, taken off your hands.
- [What trips you up](#what-trips-you-up): the places where Lua muscle memory
  goes wrong, usually right when you're too tired to notice.

## What you get

| In Lua you write | In Midnight |
| --- | --- |
| `x = x or default` (and hope `x` is never `false`) | [parameter defaults](#defaults-that-respect-false) |
| `local ok, err = pcall(function() ... end)` | [`catch`](#errors-without-the-pcall-dance) |
| `a and b or c` (and hope `b` is never falsy) | [`if` as a value](#a-ternary-that-works) |
| `if t == 'a' then ... elseif t == 'b' then ...` | [`match`](#match-instead-of-if-chains) |
| `setmetatable({}, Lamp)`, `Lamp.__index = Lamp` | [`class`](#classes-without-the-boilerplate) |
| `local M = {} ... return M` | [`module`](#modules-without-the-m-table) |
| `local MAX = 3 -- please don't change this` | [`const`](#constants-that-stay-constant) |
| `local floor, max = math.floor, math.max` | [destructuring](#destructuring) |
| `'a ' .. tostring(b) .. ' c'` | [interpolation](#strings-without-the-dots) |

### Defaults that respect false

`x = x or default` replaces `false` along with `nil`, so a boolean option
that defaults to `true` needs the long form. Midnight's defaults only fill in
`nil`, and destructured options get them too:

```lua
-- Lua
local function connect(host, opts)
  host = host or 'localhost'
  opts = opts or {}
  local retries = opts.retries or 3
  local verbose = opts.verbose
  if verbose == nil then verbose = true end
  -- ...
end
```

```midnight try
local function connect(host = 'localhost', opts = {}) {
  local { retries = 3, verbose = true } = opts
  print("{host}: {retries} retries, verbose {verbose}")
}

connect()                          -- localhost: 3 retries, verbose true
connect('db', { verbose = false }) -- db: 3 retries, verbose false
```

### Errors without the pcall dance

`pcall` wants a function, returns a flag you have to check, and hands back
the error in the same variable as the result. `catch` takes the expression
as is, and gives you the value or the handler's:

```lua
-- Lua
local ok, cfg = pcall(load_config, path)
if not ok then cfg = DEFAULTS end

local ok, data = pcall(json.decode, body)
if not ok then return nil, 'bad json: ' .. tostring(data) end
```

```midnight
local cfg = load_config(path) catch DEFAULTS
local data = json.decode(body) catch e { return nil, "bad json: {e}" }
```

The handler's `return` returns from the enclosing function, like the Lua
version. There's no way to drop an error by accident: ignoring one is
spelled `catch nil`. See [catch](/reference#catch).

### A ternary that works

`a and b or c` is Lua's ternary, until `b` is `false` or `nil` and you get
`c` instead. `if` is an expression in Midnight:

```lua
-- Lua: if user.flag is false, this is true
local enabled = user.is_admin and user.flag or true
```

```midnight
local enabled = if user.is_admin { user.flag } else { true }
```

`midnight lint` also points out the `and` / `or` cases that can go wrong.

### match instead of if chains

```lua
-- Lua
local kind = type(v)
if kind == 'string' then return 'a string of ' .. #v
elseif kind == 'number' or kind == 'boolean' then return tostring(v)
else return 'something else' end
```

```midnight try
local function describe(v) {
  return match type(v) {
    'string' => { "a string of {#v}" }
    'number' | 'boolean' => { tostring(v) }
    _ => { 'something else' }
  }
}

print(describe('owl'), describe(3), describe({}))
```

The subject is evaluated once, exactly one arm runs, and an arm can add a
guard (`_ if snoring =>`). See [match](/reference#match).

### Classes without the boilerplate

```lua
-- Lua
local Lamp = {}
Lamp.__index = Lamp

function Lamp.new(room)
  local self = setmetatable({}, Lamp)
  self.room = room
  return self
end

function Lamp:off() return self.room .. ' is dark' end
```

```midnight try
local class Lamp {
  new(room) { self.room = room }
  off() { return "{self.room} is dark" }
}

print(Lamp.new('hall'):off()) -- hall is dark
```

It's the same metatable underneath, so Lua code can use Midnight classes and
the other way around. Inheritance, `super`, and metamethods are in
[Classes](/reference#classes).

### Modules without the M table

```lua
-- Lua
local M = {}
local function helper() return 'zz' end
function M.snore() return helper() end
return M
```

```midnight
local function helper() { return 'zz' }
module function snore() { return helper() }
```

Exports are visible in the whole file, so they can call each other in any
order. See [module](/reference#module).

### Constants that stay constant

A capitalized name is a promise nobody checks, and Lua 5.4's `<const>` still
lets you change the table. Midnight's `const` is checked when compiling, and
a table written in it is frozen:

```midnight
const site = 'https://example.com'
const limits = { retries = 3, timeout = 30 }

site = 'x'          -- compile error: cannot assign to const 'site'
limits.retries = 5  -- runtime error: attempt to modify a read-only table
```

See [const](/reference#const).

### Destructuring

```lua
-- Lua
local floor, max = math.floor, math.max
local name, age = person.name, person.age or 0
```

```midnight
local { floor, max } = math
local { name, age = 0 } = person
local [first, second] = list
```

### Strings without the dots

```lua
-- Lua
print('slept ' .. tostring(hours) .. ' hours (' .. string.format('%.1f', pct) .. '%)')
```

```midnight try
local hours, pct = 7, 93.333
print("slept {hours} hours ({pct:%.1f}%)") -- slept 7 hours (93.3%)
```

Single quoted strings don't interpolate, so `'{literal}'` stays as written.

## What trips you up

Midnight is close enough to Lua that the differences hide. These are the
ones that bite.

### The syntax at a glance

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

### Not equal is !=

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

### Symbols instead of and, or, not

`&&`, `||`, and `!` replace `and`, `or`, and `not`, with the same meaning
(they short circuit and return an operand). The old words aren't keywords
anymore, they're ordinary names, so `if not done {` is a syntax error, not a
negation.

The `a && b || c` idiom has Lua's old trap: if `b` is `nil` or `false`, you
get `c`. An [if expression](/reference#if-and-match-expressions) doesn't, and
`midnight lint` points out the risky cases.

### Calls need parentheses

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

### Anonymous functions are arrows

`function(...) ... end` isn't valid as an expression. Use an arrow, and `=>`
for methods that need `self` (see [Arrow functions](/reference#arrow-functions)):

```midnight
table.sort(owls, (a, b) -> a.age < b.age)
```

Named declarations (`local function f() { }`, `function obj:m() { }`) are
still written with `function`.

### Newlines settle ambiguous calls

Lua reads a `(` at the start of a line as a call on whatever came before it,
which bites when you start a line with a parenthesized expression:

```lua
local lamp = get_lamp
(lamp_fallback or noop)()   -- Lua: get_lamp(lamp_fallback or noop)()
```

Midnight treats the line break as the end of the statement, so those are two
statements, which is almost always what was meant. To chain the call, keep it
on one line. `;` still works if you want to be explicit.

### No semicolons in tables

Lua allows `;` between table fields (`{ x = 1; 'a' }`). Midnight only allows
commas, plus an optional trailing one.

### Some Lua keywords are just names

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
- `table.freeze` (ex. from a `const` table) gets a polyfill, which on Lua
  5.1 and LuaJIT can't hide a frozen table from `pairs` and `#`.
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
[`catch`](/reference#catch), [`const`](/reference#const),
[classes](/reference#classes), [interpolation formats](/reference#formats),
and [markup](/markup). The other
differences:

- **No Lua targets.** There's one runtime (Lua 5.1 plus `goto`), so there are
  no target flags or target specific errors: `goto` is always allowed, and
  `break` doesn't have to be the last statement in a block.
- **Bit operators** always use `bit32`, with no `--bitlib` flag.
- **Error line numbers** point at the Midnight source directly, with no
  source maps or error rewriting.
- **Operator assignment evaluates index chains once.** `t[f()] += 1` calls
  `f` once (Erde calls it twice).
