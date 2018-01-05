const fs = require('fs-extra')
const {heroku} = require('heroku-cli')
const path = require('path')

const root = path.join(__dirname, '../../tmp/test')
const plugin = path.join(root, 'my-example-plugin')

fs.emptyDirSync(root)

async function test() {
  await heroku(['plugins:link', '-f'])
  await heroku(['plugins:generate', plugin])
  await heroku(['plugins:link', '-f', plugin])
  await heroku(['my-example-plugin:my-example-plugin'])
  await heroku(['my-example-plugix:my-example-plugin'])
  await heroku(['help', 'my-example-plugin'])
}
test()
.catch(err => {
  console.error(err)
  process.exit(1)
})

// heroku plugins:link -f .
// heroku plugins:generate --js my-example-plugin
// heroku plugins:link -f my-example-plugin
// heroku my-example-plugin:my-example-plugin
// heroku help my-example-plugin
