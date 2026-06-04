module.exports = {
  setupFilesAfterEnv: ['jest-extended/all'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testRegex: '(/tests/.*|(\\.|/)(test|spec))\\.(ts?|tsx?|js?|jsx?)$',
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
  ],
  // ddlapi's published dist is a vite *browser* lib build that externalizes Node's
  // `fs`, which breaks the libpg-query WASM parser under Node/Jest. Map the specifier
  // to ddlapi's TypeScript source so `buildFromDdl` runs in tests, mirroring ddlapi's
  // own jest config. The production build keeps ddlapi external (see vite.config.ts).
  moduleNameMapper: {
    '^@netcracker/qubership-apihub-ddlapi$': '<rootDir>/../ddlapi/src/index.ts',
  },
  // moduleNameMapper:{
  // "^@netcracker/qubership-apihub-json-crawl$":'<rootDir>/../qubership-apihub-json-crawl/src',
  // "^@netcracker/qubership-apihub-graphapi$":'<rootDir>/../qubership-apihub-graphapi/src',
  // },
  collectCoverage: true,
}
