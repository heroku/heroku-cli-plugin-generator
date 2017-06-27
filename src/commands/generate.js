// @flow

import Command from 'cli-engine-command'
import path from 'path'
import fs from 'fs-extra'
import execa from 'execa'

type File = {
  path: string,
  type: 'json' | 'plain',
  body: any
}

function files ({name}: {name: string}): File[] {
  return [
    {
      type: 'json',
      path: 'package.json',
      body: {
        name,
        version: '0.0.0',
        files: ['lib'],
        keywords: ['heroku-plugin'],
        license: 'ISC',
        main: 'lib/index.js',
        scripts: {
          build: "babel src -d lib --ignore '*.test.js'",
          clean: 'rimraf lib',
          prepare: 'npm run clean && npm run build',
          test: 'jest && flow && eslint .',
          release: 'np'
        },
        dependencies: {
          'cli-engine-command': '^5.1.7',
          'cli-engine-config': '^1.3.7',
          'cli-engine-heroku': '^1.1.1'
        },
        devDependencies: {
          'babel-cli': '^6.24.1',
          'babel-eslint': '^7.2.3',
          'babel-preset-flow': '^6.23.0',
          'babel-plugin-transform-class-properties': '^6.24.1',
          'babel-plugin-transform-es2015-modules-commonjs': '^6.24.1',
          'eslint': '^4.0.0',
          'eslint-config-standard': '^10.2.1',
          'eslint-plugin-flowtype': '^2.34.0',
          'eslint-plugin-import': '^2.5.0',
          'eslint-plugin-jest': '^20.0.3',
          'eslint-plugin-node': '^5.0.0',
          'eslint-plugin-promise': '^3.5.0',
          'eslint-plugin-standard': '^3.0.1',
          'flow-bin': '^0.48.0',
          'flow-typed': '^2.1.2',
          'jest': '^20.0.4',
          'rimraf': '^2.6.1'
        }
      }
    },
    {
      type: 'json',
      path: '.babelrc',
      body: {
        presets: ['flow'],
        plugins: [
          'transform-es2015-modules-commonjs',
          'transform-class-properties'
        ]
      }
    },
    {
      type: 'plain',
      path: '.eslintignore',
      body: `coverage
flow-typed
lib\n`
    },
    {
      type: 'plain',
      path: '.gitignore',
      body: `lib
node_modules\n`
    },
    {
      type: 'plain',
      path: 'src/commands/hello.js',
      body: `// @flow
import Command, {flags} from 'cli-engine-command'

export default class Status extends Command {
  static topic = 'hello'
  static command = 'world'
  static description = 'say hi'
  static flags = {
    name: flags.string({description: 'name to say hello to'})
  }

  async run () {
    let name = this.flags.name || 'world'
    this.out.log(\`hello \${name}!\`)
  }
}
`
    },
    {
      type: 'plain',
      path: 'src/commands/hello.test.js',
      body: `// @flow

import Hello from './hello'

test('it says hello to the world', async () => {
  let cmd = await Hello.mock()
  expect(cmd.out.stdout.output).toEqual('hello world!\\n')
})

test('it says hello to jeff', async () => {
  let cmd = await Hello.mock('--name', 'jeff')
  expect(cmd.out.stdout.output).toEqual('hello jeff!\\n')
})
`
    },
    {
      type: 'plain',
      path: 'src/index.js',
      body: `// @flow

import fs from 'fs-extra'
import path from 'path'

export const topic = {
  name: 'hello',
  description: 'says hello (example plugin)'
}

let dir = path.join(__dirname, 'commands')
export const commands = fs.readdirSync(dir)
  .filter(f => path.extname(f) === '.js')
  // $FlowFixMe
  .map(f => require('./commands/' + f).default)
`
    },
    {
      type: 'json',
      path: '.eslintrc',
      body: {
        extends: [
          'plugin:flowtype/recommended',
          'plugin:jest/recommended',
          'standard'
        ],
        env: {
          jest: true
        },
        plugins: [
          'flowtype',
          'jest'
        ]
      }
    },
    {
      type: 'plain',
      path: '.flowconfig',
      body: `[ignore]
<PROJECT_ROOT>/lib/.*
.*/node_modules/nock.*

[include]

[libs]

[options]
unsafe.enable_getters_and_setters=true
`
    },
    {
      type: 'plain',
      path: 'appveyor.yml',
      body: `// @flow

environment:
  nodejs_version: "8"
cache:
 - "%LOCALAPPDATA%\\Yarn"

install:
  - ps: Install-Product node $env:nodejs_version x64
  - yarn
test_script:
  - ./node_modules/.bin/jest

build: off
`
    }
  ]
}

export default class PluginGenerate extends Command {
  static topic = 'plugins'
  static command = 'generate'
  static description = 'generate a plugin'
  static help = `
  Example:
    $ heroku plugins:generate heroku-cli-status
`

  static args = [
    {name: 'name', description: 'name of plugin'}
  ]

  async run () {
    const d = path.resolve(this.args.name)
    const name = path.basename(d)

    this.out.log(`Building plugin ${name} at ${d}`)
    if (await fs.exists(d)) throw new Error(`${d} already exists`)
    await fs.mkdirp(d)
    process.chdir(d)

    for (let file of files({name})) {
      this.out.log(`Writing ${file.type} file: ${file.path}`)
      switch (file.type) {
        case 'json':
          await fs.outputJSON(file.path, file.body, {spaces: 2})
          break
        default:
          await fs.outputFile(file.path, file.body)
          break
      }
    }

    const exec = (cmd, args = []) => {
      this.out.log(`running ${cmd} ${args.join(' ')}`)
      return execa(cmd, args, {stdio: 'inherit'})
    }
    await exec('git', ['init'])
    await exec('yarn')
    await exec('flow-typed', ['install'])
    await exec('yarn', ['test'])
    this.out.log(`plugin generated. Link with ${this.out.color.cmd('heroku plugins:link ' + name)}`)
  }
}
