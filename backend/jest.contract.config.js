module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/contract/**/*.test.(ts|js)'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/contract/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.spec.{ts,js}',
    '!src/**/*.test.{ts,js}'
  ],
  coverageDirectory: 'coverage/contract',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 30000,
  transform: {
    '^.+\\.(ts)$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js', 'json']
};
