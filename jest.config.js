module.exports = {
  // File extensions Jest will process
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Root directory for tests
  rootDir: 'src',

  // Test file pattern
  testRegex: '.*\\.spec\\.ts$',

  // Transform configuration
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // Coverage collection patterns
  collectCoverageFrom: ['**/services/**/*.service.ts', '**/aws/**/*.service.ts'],

  // Coverage output directory
  coverageDirectory: '../coverage',

  // Test environment
  testEnvironment: 'node',

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Module path mapping
  moduleNameMapping: {
    '^src/(.*)$': '<rootDir>/$1',
  },

  // Clear mocks between tests
  clearMocks: true,

  // Collect coverage from these files even if they have no tests
  collectCoverageFrom: [
    '**/services/**/*.service.ts',
    '**/aws/**/*.service.ts',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
  ],
};
