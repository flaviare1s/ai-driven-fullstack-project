import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/**/*.spec.tsx',
    '<rootDir>/test/**/*.test.ts',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};

export default config;
