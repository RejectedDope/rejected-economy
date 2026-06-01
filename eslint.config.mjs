import { createRequire } from "module";

// eslint-config-next 16 exports flat config arrays directly (not legacy format).
// FlatCompat is NOT needed — just require and spread.
const require = createRequire(import.meta.url);

const coreWebVitals = require("eslint-config-next/core-web-vitals");
const typescript = require("eslint-config-next/typescript");

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default config;
