import Command, { flags } from '@cli-engine/command'
import { color } from '@heroku-cli/color'
import { cli } from 'cli-ux'
import * as execa from 'execa'
import * as fs from 'fs-extra'
import * as path from 'path'

interface File {
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
        license: 'MIT',
        dependencies: {
          '@heroku-cli/command': '^7.0.12',
          'cli-ux': '^2.0.21',
          tslib: '^1.8.1',
        },
        devDependencies: {
          '@heroku-cli/tslint': '^1.1.2',
          '@types/jest': '^22.0.1',
          '@types/node': '^8.0.58',
          husky: '^0.14.3',
          jest: '^22.0.4',
          np: '^2.18.3',
          tslint: '^5.8.0',
          prettier: '^1.9.2',
          'ts-jest': '^22.0.0',
          typescript: '^2.6.2',
        },
        'cli-engine': {
          commands: './lib/commands',
        },
        topics: {
          name,
          description: 'says hello (example plugin)',
        },
        engines: {
          node: '>=6.0.0',
        },
        scripts: {
          posttest: 'cli-engine-util',
          precommit: 'cli-engine-util',
          prepare: 'cli-engine-util',
          pretest: 'tsc',
          test: 'jest',
          release: 'np',
        },
      },
    },
    {
      type: 'plain',
      path: '.gitignore',
      body: `/coverage
/lib
/node_modules
`,
    },
    {
      type: 'plain',
      path: `src/commands/${name}/${name}.ts`,
      body: `import {Command, flags} from '@heroku-cli/command'
import cli from 'cli-ux'

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
      path: `src/commands/${name}/${name}.test.ts`,
      body: `import HelloWorld from './${name}'

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
            - v0-yarn-{{ .Environment.CIRCLE_JOB }}-{{ .Branch }}
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
build: off
version: '{build}'
shallow_clone: true
clone_depth: 1
matrix:
  fast_finish: true
environment:
  matrix:
    - nodejs_version: '9'
    - nodejs_version: '8'
    - nodejs_version: '6'
cache:
  - '%LOCALAPPDATA%\\Yarn -> appveyor.yml'
  - node_modules -> package.json
install:
  - ps: Install-Product node $env:nodejs_version x64
  - yarn
test_script:
  - yarn test --coverage
after_test:
  - ps: |
      $env:PATH = 'C:\\msys64\\usr\\bin;' + $env:PATH
      Invoke-WebRequest -Uri 'https://codecov.io/bash' -OutFile codecov.sh
      bash codecov.sh
`,
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
  globals: {
    'ts-jest': {
      skipBabel: true
    }
  }
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
      path: 'tslint.json',
      body: {
        extends: '@heroku-cli/tslint',
      },
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
          rootDir: './src',
          declaration: false,
          noUnusedLocals: true,
          importHelpers: true,
          noUnusedParameters: true,
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
  static flags: flags.Input = {
    js: flags.boolean({ description: 'use plain js style instead of typescript' }),
  }

  async run() {
    const d = path.resolve(this.args.name)
    const name = path.basename(d)

    cli.log(`Building plugin ${name} at ${d}`)
    if (await (fs as any).exists(d)) throw new Error(`${d} already exists`)
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

    const exec = async (cmd: string, args: string[] = []) => {
      cli.log(`Running ${cmd} ${args.join(' ')}`)
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
    await exec('yarn', ['run', 'precommit', '--fix'])
    await exec('yarn', ['test'])
    await exec('git', ['add', '.'])
    await exec('git', ['commit', '-m', 'init'])
    cli.log(`Plugin generated. Link with ${color.cmd('heroku plugins:link ' + name)}`)
  }
}
