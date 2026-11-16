# Reference

Everything Midnight writes becomes ordinary Lua 5.1 (with `goto`), so the
runtime half of the language (values, metatables, closures, coroutines, the
standard library) is Lua's, and the [Lua manual](https://www.lua.org/manual/5.1/)
still applies. This page is the syntax half. [Markup](/markup) and the
[CLI](/getting-started) have their own pages, and [Coming from Lua](/from-lua)
lists everything that behaves differently.

Most of this syntax comes from [Erde](https://erde-lang.github.io), and its
[reference](https://erde-lang.github.io/reference) is worth a read too.

## The shape of it

Blocks are braces. Statements end at the end of a line (or at a `;`, if you
like them). There's no `then`, `do`, or `end` anywhere.

```midnight
local function lights_out(rooms) {
  for _, room in ipairs(rooms) {
    if room.lamp { room.lamp = false }
  }
}
```

Comments are the same as Lua's, including block comments with `=` levels for
text that contains `]]`:

```midnight
-- until the end of the line
--[[ until the brackets ]]
--[==[ even if there's a ]] in here ]==]
```

Lists inside `()`, `[]`, and `{}` can always end with a comma, which keeps
diffs quiet when the list grows a line.

## Values

`nil`, `true`, `false`, numbers, strings, tables, and functions, as in Lua.
Numbers are doubles, written any way Lua 5.4 allows, plus `0b` binary:

```midnight try
print(23, 0.5, 2e3)    -- 23 0.5 2000
print(0x17, 0b10111)   -- 23 23
print(0x1.8p1)         -- 3 (a hex float: 1.5 * 2^1)
```

## Strings

Quotes, escapes, and `[[block strings]]` work like Lua's. What's new is that
double quoted and block strings fill in `{expressions}`:

```midnight try
local hour, owl = 3, 'olive'

print("{owl} is up at {hour}am")    -- olive is up at 3am
print("in an hour: {hour + 1}am")   -- in an hour: 4am
print('{owl} stays literal')        -- {owl} stays literal
print("\{owl}")                     -- {owl}
```

Single quotes never interpolate, which makes them the easy way to write text
full of braces. In the other two, `\{` is a literal brace (escaping the
closing `}` too is allowed, not required). Values go through `tostring`, so a
`nil` shows up as `nil` rather than an error.

Add `:%spec` to an interpolation to run it through `string.format`:

```midnight try
local moon = 0.734
print("moon {moon * 100:%.0f}% full")  -- moon 73% full
print("color #{0x1d2b53:%06x}")        -- color #1d2b53
```

The spec is a single `string.format` directive (flags, width, precision, and
one of `c d i o x X e E f g G q s`). The `%` has to come right after the `:`,
which is how `{owl:upper()}` stays a method call.

A block string interpolates too, and skips a newline right after `[[`, as in
Lua:

```midnight try
local bedtime = 23
io.write([[
  lights out at {bedtime}:00
  alarm at {(bedtime + 8) % 24}:00
]])
```

A string literal can be the start of a method call with no extra
parentheses: `'%02d:%02d':format(h, m)`.

## Tables

One structure for everything, as in Lua:

```midnight try
local sky = { moon = 'waning', 'orion', 'lyra' }
sky.clouds = false
print(sky.moon, sky[2], #sky) -- waning lyra 2
```

Fields are separated by commas only (Lua's `;` separator isn't allowed).

### Destructuring

Declare names from a table's fields with braces, or from its array part with
brackets:

```midnight
local { moon, clouds } = sky
local [ brightest, second ] = sky
```

Each name can carry a fallback for when the value is `nil`, and a field can be
renamed with `field: name` (the rename goes first, then the fallback):

```midnight
local { stars = 0 } = sky                   -- sky.stars or 0
local { moon: phase } = sky                 -- phase = sky.moon
local { fog: visibility = 'clear' } = sky   -- sky.fog, or 'clear'
```

Parameters destructure the same way, which is handy for options tables and
component props:

```midnight try
local function alarm({ hour = 7, snooze = true }) {
  return "alarm at {hour}, snooze {if snooze { 'on' } else { 'off' }}"
}
print(alarm({ hour = 6 })) -- alarm at 6, snooze on
```

Only one level deep: `{ a: { b } }` isn't valid. Reach for a second
statement instead.

## Functions

Declarations look like Lua's, with braces. `function T.f` and `function T:m`
work as usual:

```midnight try
local Lamp = {}
Lamp.__index = Lamp

function Lamp.new(room) {
  return setmetatable({ room = room, on = true }, Lamp)
}

function Lamp:off() {
  self.on = false
  print("{self.room} is dark")
}

Lamp.new('hallway'):off() -- hallway is dark
```

[Classes](#classes) write that boilerplate for you.

Every call needs parentheses, even with a lone string or table argument.

### Defaults

A parameter can declare what it is when it arrives as `nil`. Any parameter
can, in any order:

```midnight try
local function nap(minutes = 20, where, alarm = true) {
  return "{minutes}m on the {where}, alarm {alarm}"
}
print(nap(nil, 'couch')) -- 20m on the couch, alarm true
```

### Varargs

`...` is Lua's. Give it a name and the extra arguments arrive as a table:

```midnight try
local function dreams(who, ...scenes) {
  return "{who} dreamt {#scenes} things: {table.concat(scenes, ', ')}"
}
print(dreams('cat', 'mice', 'yarn')) -- cat dreamt 2 things: mice, yarn
```

### Arrow functions

Anonymous functions are arrows. The body is a block, or a single expression
that's returned:

```midnight
local is_late = (hour) -> hour >= 23 || hour < 5
local tuck_in = (kid) -> {
  kid.blanket = true
  return kid
}
```

A few details:

- One parameter with no default and no `...` can drop its parentheses:
  `hour -> hour + 1`, or destructured, `{ name } -> name`.
- An expression body that's a table, or several values, goes in parentheses,
  since a bare `{` would start a block: `() -> ({ ok = true })`,
  `() -> (lo, hi)`.
- `=>` instead of `->` adds a hidden first parameter, `self`, for methods
  defined inline:

```midnight try
local clock = {
  hour = 2,
  show = () => print("it's {self.hour}am"),
}
clock:show() -- it's 2am
```

### Returning several values

Lua returns several values with commas. Midnight also lets you wrap them in
parentheses, which reads better once they span lines:

```midnight
local function bounds(list) {
  return (
    math.min(unpack(list)),
    math.max(unpack(list)),
  )
}
```

## Scopes

`local` is Lua's local. Midnight adds two more ways to declare a name.

### global

`global x = ...` writes `_G.x`, and inside that block, `x` means the global
even if a local `x` exists outside it:

```midnight try
local hour = 1

do {
  global hour = 23
  print(hour)          -- 23
}

print(hour, _G.hour)   -- 1 23
```

### module

`module` marks an export. A file with `module` declarations returns them,
collected in a table named `_MODULE`:

```midnight
-- lamp.mn
module brightness = 0.2
module function dim(by = 0.1) {
  brightness = math.max(0, brightness - by)
}
```

```midnight
local lamp = require('lamp')
lamp.dim()

local { dim } = require('lamp')  -- or import just what you need
```

`_MODULE` is a plain table you can modify (give it a metatable, add fields by
hand). Two rules: such a file can't also `return` at the top level, because
then it's unclear which value is the module, and the word `module` is taken,
so Lua 5.1's `module()` function isn't callable.

## Operators

| Kind | Operators |
| --- | --- |
| Arithmetic | `+` `-` `*` `/` `//` `%` `^`, unary `-` |
| Comparison | `==` `!=` `<` `>` `<=` `>=` |
| Logic | `&&` `\|\|` `!` |
| Strings and length | `..` `#` |
| Bits | `&` `\|` `~` (xor) `<<` `>>`, unary `~` |

`!=` is "not equal" (Lua's `~=` means xor assignment here, see
[Coming from Lua](/from-lua#not-equal-is)). `&&` and `||` behave exactly like
Lua's `and` and `or`: they short circuit, and give back one of their
operands. `//` is floor division.

### Bits

The VM is Lua 5.1, which has no bit operators, so these become calls into the
`bit32` library that Midnight bundles. They work on unsigned 32 bit values,
which matters for negatives and `~`:

```midnight try
print(0xf0 & 0x3c, 0xf0 | 0x0f, 0xf0 ~ 0xff) -- 48 255 15
print(1 << 4, 256 >> 4)                       -- 16 16
print(~0)                                     -- 4294967295
```

### Assignment operators

Put `=` after any operator that isn't a comparison to update in place:
`+=`, `-=`, `..=`, `//=`, `&&=`, `|=`, and the rest. Several targets work, as
with plain assignment:

```midnight try
local sheep, yawns = 0, 0
sheep, yawns += 10, 1
sheep *= 2

local status = 'awake'
status ..= ', barely'
print(sheep, yawns, status) -- 20 1 awake, barely
```

Index expressions on the left are evaluated once: in `t[next_id()] += 1`,
`next_id` runs one time.

## Control flow

The usual suspects, all with braces:

```midnight
if hour >= 23 {
  print('late')
} elseif hour < 5 {
  print('very late')
} else {
  print('reasonable')
}

for countdown = 10, 1, -1 { print(countdown) }

for i, star in ipairs({ 'vega', 'deneb', 'altair' }) {
  print(i, star)
}

while !asleep { count_sheep() }

repeat {
  count_sheep()
} until asleep

do {
  local scratch = 'only in here'
}
```

### break, continue, goto

`break` leaves the innermost loop. `continue` jumps to its next turn, in any
kind of loop:

```midnight try
for hour = 20, 26 {
  if hour % 2 == 1 { continue }
  print("check on the baby at {hour % 24}:00")
}
```

`goto label` and `::label::` are Lua 5.2's, available everywhere:

```midnight
for _, line in ipairs(lines) {
  for _, word in ipairs(line) {
    if word == 'goodnight' { goto done }
  }
}
::done::
```

## match

`match` compares one value against a list of arms, top to bottom, and runs
the first that fits:

```midnight
match signal {
  'doorbell' => { wake_up() }
  'rain' | 'wind' => { roll_over() }      -- either one
  _ if snoring => { nudge() }             -- a guard
  _ => { keep_sleeping() }                -- everything else
}
```

Under the hood it's an `if` / `elseif` chain on a local copy of the subject:

```lua
do
  local subject = signal
  if subject == "doorbell" then wake_up()
  elseif subject == "rain" or subject == "wind" then roll_over()
  elseif snoring then nudge()
  else keep_sleeping() end
end
```

Which leads to the rules:

- The subject is evaluated once. Exactly one arm runs; nothing falls through.
- A pattern is an expression tested with `==`. A name in a pattern is the
  value it holds (ex. a constant `ALARM =>`), never a new variable.
- `|` joins patterns, so a bitwise or inside a pattern needs parentheses:
  `(FLAG_A | FLAG_B) =>`.
- `pattern if cond =>` needs both. `_ if cond =>` is only the condition.
- `_ =>` must be last. An arm after it is a compile error, since it could
  never run.
- `break` and `continue` inside an arm affect the surrounding loop.
- `match` is only special in the right spot, so `s:match(p)`, `t.match`,
  `local match = 1`, and `match(x)` (a call) keep working. `match (x) {` is
  a match.

## if and match expressions

Put `if` or `match` where a value goes and it produces one:

```midnight
local lamp = if dark { 'on' } else { 'off' }

local sound = match animal {
  'owl' => { 'hoo' }
  'cricket' | 'frog' => { 'chirp' }
  _ => { '...' }
}
```

These fix the classic `a and b or c` bug: an if expression gives you the
chosen branch's value even when that value is `nil` or `false`. With
`dark && nil || 'off'` you'd get `'off'`, and `midnight lint` flags that
pattern when it can tell.

- Each branch holds one expression, and only its first value is kept. Use a
  statement when a branch needs to do more.
- There has to be a way out: `else` for `if`, `_ =>` for `match`. A missing
  case can't quietly become `nil`.
- `elseif`, `|`, and guards all work, the same as in the statements.
- At the start of a line, `if` and `match` are still statements.
- On the right of `local x =`, `x =`, or `return` (including an arrow's
  expression body), they compile to a plain `if` chain. Anywhere else (a
  function argument, a table field, a markup child) they're wrapped in a
  function that's called on the spot, which allocates. In a tight loop,
  assign to a local first.
- For `match` to be an expression, the subject has to be on the same line,
  followed by `{` and an arm. `local m = match` is just a variable.

## Classes

`class` declares a table with methods, a constructor, and the metatable
wiring that usually goes with them:

```midnight try
local class Lamp {
  watts = 40                                -- a field, shared by every lamp
  new(room, on = true) {                    -- the constructor
    self.room = room
    self.on = on
  }
  off() {                                   -- a method, with an implicit self
    self.on = false
    print("{self.room} is dark")
  }
  __tostring() { return "<lamp in the {self.room}>" }
}

local hall = Lamp.new('hallway')
hall:off()            -- hallway is dark
print(hall, hall.watts) -- <lamp in the hallway> 40
```

That's the `Lamp` from [Functions](#functions), plus a field and a
metamethod. It compiles to the same Lua you'd write by hand:

```lua
local Lamp = {}
Lamp.__index = Lamp
Lamp.watts = 40
function Lamp.new(room, on)
  local self = setmetatable({}, Lamp)
  if on == nil then on = true end
  self.room = room
  self.on = on
  return self
end
function Lamp:off() ... end
function Lamp:__tostring() ... end
```

The members:

- `name = value` is a field on the class itself, so every instance sees it
  until it sets its own. Good for defaults and constants.
- `name(params) { ... }` is a method, defined as `function Class:name`. The
  parameters take defaults, destructuring, and `...` like any function's.
- Metamethods (`__tostring`, `__eq`, `__lt`, ...) are just methods. Define
  `__index` yourself and it replaces the generated one.
- `new(params) { ... }` is the constructor, called with a dot:
  `Lamp.new('attic')`. `self` arrives as a fresh instance and is returned at
  the end, unless the body ends in a `return` of its own.
- `static name(params) { ... }` is a function on the class with no `self`,
  defined as `function Class.name` and called with a dot: `Lamp.parse(s)`.
  A `static new` is a constructor that builds its instance itself, ex.
  `return setmetatable({ room = room }, Lamp)`.
- A class without `new` gets one that takes no arguments and returns an
  empty instance.
- Members are separated by newlines. `,` and `;` are allowed too, for a class
  on one line.
- `static` is only a keyword before a name, so a field or method called
  `static` still works.

### Inheritance

`class Child : Parent` looks up anything the child doesn't define on the
parent. Inside the child, `super` is the parent:

```midnight try
local class Lamp {
  new(room) { self.room = room }
  off() { return "{self.room} is dark" }
  __tostring() { return "<lamp in the {self.room}>" }
}

local class NightLight : Lamp {
  off() { return super.off(self) .. ", except for a little glow" }
}

local glow = NightLight.new('nursery')
print(glow:off())  -- nursery is dark, except for a little glow
print(glow)        -- <lamp in the nursery>
```

- Call parent methods with a dot and pass `self` yourself:
  `super.off(self)`. `super:off()` would hand the parent class in as `self`.
- A subclass without `new` (like `NightLight`) gets one that passes its
  arguments to the parent's `new` and returns the result as a `NightLight`.
- A subclass with its own `new` starts from a fresh `self` and doesn't run
  the parent's constructor. Put shared setup in a method on the parent and
  call it, ex. `super.init(self, room)`.
- Metamethods are copied down when the subclass is declared, since Lua looks
  them up on the metatable itself rather than through `__index`. That's why
  `print(glow)` works. One added to the parent later isn't copied.
- The parent can be a dotted name, `class Dimmer : lamps.Lamp`.
- `super` always means the parent the class was declared with, even if a
  method has a local of the same name. Outside a subclass it's an ordinary
  name.

### Declaring classes

`local class`, `global class`, and `module class` work like the other
[scopes](#scopes). `module class Lamp` exports it, so another file can
`local { Lamp } = require('lamp')`. A bare `class Lamp` works like a bare
`function`: it assigns to a `Lamp` already in scope, or to a global.

`class` is only a keyword when a name follows it on the same line, so
`local class = 'x'`, `t.class`, and `class="..."` on a markup element keep
working.

## Markup

Elements are part of the grammar. Each one compiles to a call,
`h(tag, props, ...children)`, and the `midnight.markup` runtime turns those
into HTML:

```midnight try
local Star = ({ name, bright }) -> <li class={if bright { 'bright' } else { nil }}>
  {name}
</li>

local html = require('midnight.markup').render(<ul>
  <Star name="sirius" bright/>
  <Star name="polaris"/>
</ul>)
print(html)
```

A `<` only starts an element where a value can begin, so `a < b` is still a
comparison. The [Markup](/markup) page covers the rest: components, state,
scoped styles, and pages that update live.

## Reserved words

`break`, `continue`, `do`, `else`, `elseif`, `for`, `function`, `global`,
`if`, `in`, `local`, `module`, `repeat`, `return`, `until`, `while`, `true`,
`false`, and `nil`.

`goto`, `match`, and `class` only act as keywords in their own constructs. Lua's
`and`, `or`, `not`, `then`, and `end` aren't reserved at all, so they're
free to use as names. One nice side effect: a half asleep `if not ready`
fails to compile instead of doing something odd.
