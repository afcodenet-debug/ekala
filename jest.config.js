/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/server/notifications'],
  testMatch: ['**/__tests__/**/*.test.[tj]s'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true
};
