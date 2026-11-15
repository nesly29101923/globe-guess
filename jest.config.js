/** Logic tests: plain TypeScript, no React Native. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, resolveJsonModule: true, module: 'commonjs', target: 'es2020', types: ['jest', 'node'] }, diagnostics: { ignoreCodes: [151001] } }] },
};
