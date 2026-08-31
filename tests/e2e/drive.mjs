// Ad-hoc driver: launch Bifrost, optionally navigate to a view, dump visible
// text, and screenshot. For quick manual verification of a change.
//
//   xvfb-run -a node tests/e2e/drive.mjs [--view=clusters] [--shot=/tmp/x.png] [--text]
//
// --view=<label>  click a nav section (connections|clusters|scripts|...)
// --shot=<path>   screenshot destination (default /tmp/bifrost-drive.png)
// --text          print the first ~800 chars of visible text
import { launchBifrost } from './harness.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const b = await launchBifrost()
try {
  console.log('TITLE:', await b.win.title())
  console.log('TABS:', await b.win.locator('[role="tab"]').count())
  if (typeof args.view === 'string') {
    await b.goto(args.view)
    console.log('VIEW:', args.view)
  }
  if (args.text) {
    const t = (await b.win.locator('body').innerText()).slice(0, 800).replace(/\n+/g, ' | ')
    console.log('TEXT:', t)
  }
  const out = typeof args.shot === 'string' ? args.shot : '/tmp/bifrost-drive.png'
  console.log('SHOT:', await b.shot(out))
} finally {
  await b.close()
}
