// The playground's examples (the Examples... menu). They're files in
// examples/, put in the page as <template>s by src/playground.midnight. The
// first is what a new visitor sees.
import { dom } from '@taybart/corvid'

export const EXAMPLES = dom.els('template.pg-example').map((t) => ({
  name: t.el.dataset.name,
  code: t.el.content.textContent,
}))
