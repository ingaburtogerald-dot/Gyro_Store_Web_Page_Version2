// ESLint config for server (CommonJS, Node)
// Using .eslintrc.cjs format because server is CJS.
module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  extends: ["eslint:recommended"],
  rules: {
    // Prevent new issues without breaking existing code
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "no-undef": "error",

    // Express patterns: next is required even if unused
    // (handled by argsIgnorePattern above for _next)
  },
  ignorePatterns: ["node_modules/"],
};
