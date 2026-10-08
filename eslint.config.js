import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "pagefind/**", "test-results/**", "playwright-report/**", "css/**", "content/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["js/**/*.js", "app.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["build.js", "scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["tests/**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
  },
];
