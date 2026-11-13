# Reference

Midnight is a syntax layer over Lua: every construct lowers to ordinary Lua
5.1 (plus `goto`), so the language maps closely to Lua. This page covers the
syntax; the [CLI](/getting-started) and
[markup](https://github.com/taybart/midnight/blob/main/docs/MARKUP.md) are
documented separately.

## Comments

```midnight
-- a line comment
--[[ a block comment ]]
```

## Types

Midnight has the same types as Lua: `nil`, booleans, numbers, strings, tables,
and functions.

```midnight
local n = 42
local hex = 0xff
local bin = 0b1010     -- 10
local flag = true
local nothing = nil
```

### Strings

Single quotes are literal; double quotes and block strings interpolate
`{expr}`. Interpolation formats (`{expr:%spec}`) format a value with
`string.format`.

```midnight
local name = 'world'                 -- literal, no interpolation
print("hello {name}")                -- hello world
print("progress {1/3:%.1f}%")        -- progress 0.3%
print([[
  a block string
  also interpolates: {name}
]])
```

## Tables

Tables are Midnight's only composite type: objects, arrays, and both at once.

```midnight
local t = { a = 1, b = 2 }
t.c = 3
print(t.a, t['b'], t.c)   -- 1 2 3
```

### Destructuring

```midnight
local { map, filter } = require('pl.tablex')   -- fields
local [ first, second ] = { 'hello', 'world' } -- indices
local { name = 'anon' } = opts                  -- with a default
```

## Functions

Functions use `{ ... }` blocks and `return` as usual.

```midnight
local function greet(name) {
  print("hello {name}")
}
```

### Parameter defaults

```midnight
local function greet(name = 'world') {
  print("hello {name}")
}
greet()            -- hello world
greet('midnight')  -- hello midnight
```

### Varargs

```midnight
local function join(sep, ...strings) {
  return table.concat(strings, sep)
}
print(join(', ', 'a', 'b', 'c')) -- a, b, c
```

### Arrow functions

`->` is a normal function; `=>` takes an implicit `self`.

```midnight
local add = (a, b) -> a + b
local pick = (t, k) -> t[k]

local obj = {
  value = 10,
  get = () => self.value,
}
print(obj:get()) -- 10
```

## Scopes

Declarations are `local` by default; `global` and `module` opt out.

```midnight
local x = 1        -- this block only
global y = 2       -- _G.y
module z = 3       -- exported by the module
```

## Operators

Operators are symbols (as in Rust, Go, JavaScript). Logical operators are
`&&`, `||`, `!`; inequality is `!=`. Bitwise operators compile to a `bit32`
library.

| Kind | Operators |
| --- | --- |
| Arithmetic | `+` `-` `*` `/` `//` `%` `^` |
| Relational | `==` `!=` `<` `>` `<=` `>=` |
| Logical | `&&` `\|\|` `!` |
| Bitwise | `\|` `~` `&` `<<` `>>` `~x` |
| Other | `..` (concat) `#` (length) |

### Compound assignment

Any binary operator supports `op=`, and index chains are evaluated once.

```midnight
a += 1
a *= 5
t[f()] += 1   -- f() is called once
```

## Control flow

```midnight
do {
  local scoped = true
}

if a > 0 {
  print('positive')
} else {
  print('not positive')
}

for i = 1, 10 {
  print(i)
}

while not done {
  step()
}

repeat
  step()
until done

for i = 1, 10 {
  if i % 2 == 0 { continue }
  print(i)
}
```

## match

Rust-style `match`: patterns compare with `==`, there is no fallthrough, and
`|` separates alternatives.

```midnight
match mode {
  "movie" => { play() }
  "show" | "series" => { play() }
  _ if count > 5 => { skip() }
  _ => { stop() }
}
```

## if / match expressions

Where an expression is expected, `if` and `match` have a value — the value of
the branch taken, even when it's `nil`.

```midnight
local label = if user.admin { user.title } else { 'member' }

local icon = match entry.kind {
  "dir" => { 'folder' }
  _ => { 'file' }
}
```

## Markup

Midnight has JSX-style elements for HTML, rendered by the `midnight.markup`
runtime (this site is built with them).

```midnight
local Card = (props) -> <section class="card">
  <h2>{props.title}</h2>
  {props.children}
</section>

return () -> <html>
  <body>
    <Card title="hi"><p>hello</p></Card>
  </body>
</html>
```

See the [markup docs](https://github.com/taybart/midnight/blob/main/docs/MARKUP.md)
for components, scoped styles, and interactive pages.
