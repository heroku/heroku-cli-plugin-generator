import * as path from 'path'
import { getCommands } from 'cli-engine-heroku'

export const commands = getCommands(path.join(__dirname, 'commands'))
