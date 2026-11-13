// The playground's examples (the Examples... menu). The first is what a
// new visitor sees.
import { TIMEOUT_MS } from '/play/runner.js'

export const EXAMPLES = [
  {
    name: 'Counting sheep',
    code: `local function count_sheep(name = 'night owl', ...sheep) {
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
`,
  },
  {
    name: 'Tables and destructuring',
    code: `local sky = { moon = 'waning', 'orion', 'lyra' }

local { moon: phase, stars = 0 } = sky
local [ brightest ] = sky
print(phase, stars, brightest)

local function alarm({ hour = 7, snooze = true }) {
  return "alarm at {hour}, snooze {if snooze { 'on' } else { 'off' }}"
}
print(alarm({ hour = 6 }))
`,
  },
  {
    name: 'match and if expressions',
    code: `local function mood(hour) {
  return match hour {
    22 | 23 => { 'winding down' }
    0 | 1 | 2 | 3 | 4 => { 'should be asleep' }
    _ if hour < 12 => { 'morning' }
    _ => { 'awake' }
  }
}

for _, hour in ipairs({ 23, 2, 9, 15 }) {
  local suffix = if hour < 12 { 'am' } else { 'pm' }
  print("{(hour - 1) % 12 + 1}{suffix}: {mood(hour)}")
}
`,
  },
  {
    name: 'Interpolation formats',
    code: `local moon = 0.734
print("the moon is {moon * 100:%.0f}% full")

for hour = 21, 26 {
  print("{hour % 24:%02d}:00  {string.rep('z', hour - 20)}")
}
`,
  },
  {
    name: 'A page (markup)',
    code: `local { css, map } = require('midnight.markup')

local s = css({
  sky = {
    font_family = 'system-ui, sans-serif',
    background = '#0b0f1d',
    color = '#e8ebf4',
    padding = '2rem',
    min_height = '100vh',
    margin = 0,
  },
  star = { color = '#ffcb6b' },
})

local stars = { 'sirius', 'canopus', 'arcturus', 'vega' }

-- return markup and it shows up on the Page tab
return <html>
  <body class={s.sky}>
    <h1>tonight's sky</h1>
    <ul>
      {map(stars, (name, i) -> <li>{i}. <span class={s.star}>{name}</span></li>)}
    </ul>
  </body>
</html>
`,
  },
  {
    name: 'A clickable page',
    code: `local { state, css } = require('midnight.markup')

local s = css({
  sky = {
    font_family = 'system-ui, sans-serif',
    background = '#0b0f1d',
    color = '#e8ebf4',
    padding = '2rem',
    min_height = '100vh',
    margin = 0,
  },
  button = { font_size = '1rem', padding = '.5rem 1rem', cursor = 'pointer' },
})

-- each component keeps its own state between clicks
local Sheep = ({ owl = 'night owl' }) -> {
  local st = state({ count = 0 })
  local mood = match st.count {
    0 => { 'wide awake' }
    1 | 2 | 3 => { 'getting drowsy' }
    _ => { 'fast asleep' }
  }
  return <section>
    <h2>goodnight, {owl}</h2>
    <p>{st.count} sheep so far, {mood}</p>
    <button class={s.button} onclick={() -> {
      st.count += 1
      print("{owl} counted sheep #{st.count}")
    }}>count another</button>
  </section>
}

return <html>
  <body class={s.sky}>
    <Sheep/>
    <Sheep owl="olive"/>
  </body>
</html>
`,
  },
  {
    name: 'A loop that never ends',
    code: `-- runs are stopped after ${TIMEOUT_MS / 1000} seconds
local sheep = 0
while true {
  sheep += 1
}
`,
  },
]
