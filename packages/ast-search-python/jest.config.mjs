/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    // Strip .js extensions from relative imports (TypeScript ESM style)
    "^(\\.{1,2}/.+)\\.js$": "$1",
    // Resolve ast-search-js workspace package from local build
    "^ast-search-js/plugin$": "<rootDir>/../../packages/ast-search-js/build/plugin.js",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  roots: ["src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
};

export default config;
