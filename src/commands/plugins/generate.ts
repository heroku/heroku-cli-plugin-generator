import { Command } from '@cli-engine/command'
import { cli } from 'cli-ux'
import { color } from '@heroku-cli/color'
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
          '@heroku-cli/command': '7',
          '@heroku-cli/color': '7',
          'cli-ux': '2',
          tslib: '1',
        },
        devDependencies: {
          '@cli-engine/util': '1',
          '@heroku-cli/tslint': '1',
          '@types/ansi-styles': '2',
          '@types/jest': '21',
          '@types/nock': '9',
          '@types/node': '8',
          '@types/supports-color': '3',
          husky: '0',
          jest: '22',
          prettier: '1',
          tslint: '5',
          'ts-jest': '22',
          typescript: '2',
        },
        'cli-engine': {
          commands: './lib/commands',
        },
        scripts: {
          posttest: 'cli-engine-util',
          precommit: 'cli-engine-util',
          prepare: 'cli-engine-util',
          pretest: 'tsc',
          test: 'jest',
        },
      },
    },
    {
      type: 'plain',
      path: '.gitignore',
      body: `/package-lock.json
/coverage
/lib
/node_modules
`,
    },
    {
      type: 'plain',
      path: 'src/commands/hello/world.ts',
      body: `import {Command, flags} from '@heroku-cli/command'
import { cli } from 'cli-ux'

export default class HelloWorld extends Command {
  static description = 'say hi'
  static flags = {
    name: flags.string({description: 'name to say hello to'})
  }

  async run () {
    let name = this.flags.name || 'world'
    cli.log(\`hello \${name}!\`)
  }
}
`,
    },
    {
      type: 'plain',
      path: 'src/commands/hello/world.test.ts',
      body: `import HelloWorld from './world'

test('it says hello to the world', async () => {
  const {stdout} = await HelloWorld.mock()
  expect(stdout).toEqual('hello world!\\n')
})

test('it says hello to jeff', async () => {
  const {stdout} = await HelloWorld.mock(['--name', 'jeff'])
  expect(stdout).toEqual('hello jeff!\\n')
})
`,
    },
    {
      type: 'plain',
      path: '.circleci/config.yml',
      body: `---
version: 2
jobs:
  node-latest: &test-build
    docker:
      - image: node:latest
    working_directory: /cli
    steps:
      - checkout
      - restore_cache:
          keys:
            - v0-yarn-{{ .Environment.CIRCLE_JOB }}-{{ .Branch }}-{{checksum "yarn.lock"}}
            - v0-yarn-{{ .Environment.CIRCLE_JOB }}-{{ .Branch }}-
            - v0-yarn-{{ .Environment.CIRCLE_JOB }}-master
      - run: yarn
      - run: yarn test --coverage
      - run: curl -s https://codecov.io/bash | bash
      - save_cache:
          key: v0-yarn-{{ .Environment.CIRCLE_JOB }}-{{ .Branch }}-{{checksum "yarn.lock"}}
          paths:
            - /cli/node_modules
            - /usr/local/share/.cache/yarn
  node-8:
    <<: *test-build
    docker:
      - image: node:8
  node-6:
    <<: *test-build
    docker:
      - image: node:6

workflows:
  version: 2
  test:
    jobs:
      - node-latest
      - node-8
      - node-6
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
  - yarn test

build: 'off'
`,
    },
    {
      type: 'json',
      path: 'tslint.json',
      body: { extends: '@heroku-cli/tslint' },
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
      type: 'json',
      path: 'tsconfig.json',
      body: {
        compilerOptions: {
          alwaysStrict: true,
          declaration: false,
          importHelpers: true,
          listEmittedFiles: true,
          module: 'commonjs',
          noUnusedLocals: true,
          noUnusedParameters: true,
          outDir: './lib',
          rootDir: './src',
          strict: true,
          target: 'es2016',
        },
        include: ['./src/**/*'],
      },
    },
  ]
}

export default class PluginGenerate extends Command {
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

    cli.log(`Building plugin ${color.green(name)} at ${color.yellow(d)}`)
    if (await (<any>fs).exists(d)) throw new Error(`${d} already exists`)
    await fs.mkdirp(d)
    process.chdir(d)

    for (let file of files({ name })) {
      cli.log(`Writing ${color.green(file.type)} file: ${color.yellow(file.path)}`)
      switch (file.type) {
        case 'json':
          await fs.outputJSON(file.path, file.body, { spaces: 2 })
          break
        default:
          await fs.outputFile(file.path, file.body)
          break
      }
    }

    const exec = async (cmd: string, args: string[] = []) => {
      cli.log(`Running ${color.cmd(cmd)} ${color.cmd(args.join(' '))}`)
      try {
        await execa(cmd, args, { stdio: 'inherit' })
      } catch (err) {
        if (err.code === 'ENOENT') {
          throw new Error(`${err.message}
${cmd} is not installed. Install ${cmd} to develop CLI plugins.`)
        } else throw err
      }
    }
    await exec('git', ['init'])
    await exec('yarn')
    await exec('yarn', ['exec', 'prettier', '--', '--write', 'src/**/*.ts'])
    await exec('yarn', ['test'])
    await exec('git', ['add', '.'])
    await exec('git', ['commit', '-m', 'init'])
    cli.log(`Plugin generated. Link with ${color.cmd('heroku plugins:link ' + this.args.name)}`)
  }
}
