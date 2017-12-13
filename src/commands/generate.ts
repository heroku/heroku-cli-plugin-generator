import { Command } from 'cli-engine-command'
import { cli } from 'cli-ux'
import { color } from 'heroku-cli-color'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as execa from 'execa'

type File = {
  path: string
  type: 'json' | 'plain'
  body: any
}

function files({ name }: { name: string }): File[] {
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
        dependencies: {
          'cli-engine-heroku': 'ts',
          'cli-ux': '^2.0.5',
        },
        devDependencies: {
          '@types/execa': '^0.8.0',
          '@types/fs-extra': '^5.0.0',
          '@types/lodash.flatten': '^4.4.3',
          '@types/node': '^8.0.58',
          '@types/supports-color': '^3.1.0',
          'del-cli': '^1.1.0',
          husky: '^0.14.3',
          jest: '^20.0.4',
          'lint-staged': '^6.0.0',
          np: '^2.8.1',
          prettier: '^1.9.2',
          'ts-jest': '^21.2.4',
          typescript: '^2.6.2',
        },
        main: 'lib/index.js',
        scripts: {
          posttest: "prettier -l 'src/**/*.ts'",
          precommit: 'lint-staged',
          prepare: 'del-cli lib && tsc && del-cli "lib/**/*.test.+(d.ts|js)"',
          pretest: 'tsc',
          test: 'jest',
          release: 'np',
        },
        types: './lib/index.d.ts',
      },
    },
    {
      type: 'plain',
      path: '.gitignore',
      body: `/lib
/node_modules
`,
    },
    {
      type: 'plain',
      path: 'src/commands/hello/world.ts',
      body: `import {Command, flags} from 'cli-engine-heroku'
import { cli } from 'cli-ux'

export default class HelloWorld extends Command {
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
`,
    },
    {
      type: 'plain',
      path: 'src/commands/hello/world.test.ts',
      body: `import HelloWorld from './hello'

test('it says hello to the world', async () => {
  let cmd = await HelloWorld.mock()
  expect(cmd.out.stdout.output).toEqual('hello world!\\n')
})

test('it says hello to jeff', async () => {
  let cmd = await HelloWorld.mock('--name', 'jeff')
  expect(cmd.out.stdout.output).toEqual('hello jeff!\\n')
})
`,
    },
    {
      type: 'plain',
      path: 'src/index.ts',
      body: `import * as path from 'path'
import { getCommands } from 'cli-engine-heroku'


export const topic = {
  name: 'hello',
  description: 'says hello (example plugin)'
}

export const commands = getCommands(path.join(__dirname, 'commands'))
`,
    },
    {
      type: 'plain',
      path: '.circleci/config.yml',
      body: `---
version: 2
jobs:
  build:
    docker:
      - image: node:9
    working_directory: ~/cli-plugin
    steps:
      - checkout
      - restore_cache:
          keys:
            - yarn-{{ .Branch }}-{{ checksum "yarn.lock" }}
            - yarn
      - run: yarn
      - run: yarn test --coverage
      - run: bash <(curl -s https://codecov.io/bash)
      - save_cache:
          key: yarn-{{ .Branch }}-{{ checksum "yarn.lock" }}
          paths:
            - node_modules
            - /usr/local/share/.cache/yarn
`,
    },
    {
      type: 'plain',
      path: 'appveyor.yml',
      body: `---
environment:
  nodejs_version: "9"
cache:
  - "%LOCALAPPDATA%\\\\Yarn"

install:
  - ps: Install-Product node $env:nodejs_version x64
  - yarn
test_script:
  - ./node_modules/.bin/jest

build: 'off'
`,
    },
    {
      type: 'json',
      path: '.lintstagedrc',
      body: {
        '**/*.ts': ['prettier --write', 'git add', 'jest --bail --findRelatedTests'],
      },
    },
    {
      type: 'plain',
      path: '.prettierrc',
      body: `printWidth: 120
semi: false
singleQuote: true
trailingComma: "all"
`,
    },
    {
      type: 'plain',
      path: '.editorconfig',
      body: `root = true

[*]
indent_style = space
indent_size = 2
tab_width = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
`,
    },
    {
      type: 'plain',
      path: 'jest.config.js',
      body: `module.exports = {
  setupTestFrameworkScriptFile: "./test/init.ts",
  mapCoverage: true,
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': '<rootDir>/node_modules/ts-jest/preprocessor.js',
  },
}
`,
    },
    {
      type: 'plain',
      path: 'test/init.ts',
      body: `import cli from 'cli-ux'

beforeEach(() => {
  cli.config.mock = true
})
`,
    },
    {
      type: 'json',
      path: 'tsconfig.json',
      body: {
        compilerOptions: {
          strict: true,
          alwaysStrict: true,
          module: 'commonjs',
          outDir: './lib',
          declaration: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          target: 'es2017',
          lib: ['es7'],
        },
        include: ['./src/**/*'],
      },
    },
  ]
}

export default class PluginGenerate extends Command {
  static topic = 'plugins'
  static command = 'generate'
  static description = 'generate a plugin'
  static help = `
  Example:
    $ heroku plugins:generate heroku-cli-status
    $ heroku plugins:link heroku-cli-status
    $ heroku hello:world
`

  static args = [{ name: 'name', description: 'name of plugin' }]

  async run() {
    const d = path.resolve(this.args.name)
    const name = path.basename(d)

    cli.log(`Building plugin ${name} at ${d}`)
    if (await (<any>fs).exists(d)) throw new Error(`${d} already exists`)
    await fs.mkdirp(d)
    process.chdir(d)

    for (let file of files({ name })) {
      cli.log(`Writing ${file.type} file: ${file.path}`)
      switch (file.type) {
        case 'json':
          await fs.outputJSON(file.path, file.body, { spaces: 2 })
          break
        default:
          await fs.outputFile(file.path, file.body)
          break
      }
    }

    const exec = (cmd: string, args: string[] = []) => {
      cli.log(`Running ${cmd} ${args.join(' ')}`)
      return execa(cmd, args, { stdio: 'inherit' })
    }
    await exec('git', ['init'])
    await exec('yarn')
    await exec('flow-typed', ['install'])
    await exec('yarn', ['test'])
    await exec('git', ['add', '.'])
    await exec('git', ['commit', '-m', 'init'])
    cli.log(`Plugin generated. Link with ${color.cmd('heroku plugins:link ' + name)}`)
  }
}
