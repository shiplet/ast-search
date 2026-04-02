/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  roots: ["src"],
  testMatch: ["**/__tests__/?(*.)+(spec|test).[tj]s?(x)"],
  moduleNameMapper: {
    // Resolve .js extensions in relative imports (ts-jest requirement)
    "^(\\.{1,2}/.+)\\.js$": "$1",
    // Resolve workspace packages — must come before the general ast-search-js entry
    "^ast-search-js/plugin$": "<rootDir>/../ast-search-js/build/plugin.js",
    "^ast-search-js$": "<rootDir>/../ast-search-js/build/main.js",
    // MCP SDK — redirect subpath imports to CJS dist for Jest's CommonJS environment
    "^@modelcontextprotocol/sdk/(.+)\\.js$": "<rootDir>/node_modules/@modelcontextprotocol/sdk/dist/cjs/$1.js",
  },
};

export default config;
