// @flow

import fs from 'fs-extra'
import path from 'path'

let dir = path.join(__dirname, 'commands')
export const commands = fs.readdirSync(dir)
.filter(f => path.extname(f) === '.js')
// $FlowFixMe
.map(f => require('./commands/' + f).default)
