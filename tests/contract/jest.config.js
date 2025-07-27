const { defaults } = require('jest-config');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/contract/**/*.test.(ts|js)',
    '**/src/**/*.contract.test.(ts|js)'
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
  globals: {
    'ts-jest': {
      useESM: false
    }
  },
  testTimeout: 30000
};
