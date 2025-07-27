module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/src/tests/contract/**/*.test.(ts|js)'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/contract/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,js,tsx,jsx}',
    '!src/**/*.d.ts',
    '!src/**/*.spec.{ts,js}',
    '!src/**/*.test.{ts,js}'
  ],
  coverageDirectory: 'coverage/contract',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 60000,
  maxWorkers: 1,
  runInBand: true,
  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
        target: 'es2018',
        lib: ['es2018', 'dom'],
        declaration: false,
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true
      }
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@pact-foundation|axios|socket.io-client)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  forceExit: true
};
