import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  // ── Ignores ──
  { ignores: ["build/", "node_modules/", "public/build/", ".cache/", "app/click-logger.ts"] },

  // ── Base JS rules ──
  eslint.configs.recommended,

  // ── TypeScript rules ──
  ...tseslint.configs.recommended,

  // ── Project-wide overrides ──
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "import-x": importX,
    },
    rules: {
      // ── Prevenir nuevos problemas sin romper los 127+ `any` existentes ──
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // ── React hooks ──
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── Import order ──
      "import-x/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          pathGroups: [
            { pattern: "react", group: "builtin", position: "before" },
            { pattern: "react-dom/**", group: "builtin", position: "before" },
            { pattern: "~/**", group: "internal", position: "before" },
            { pattern: "@shared/**", group: "internal", position: "before" },
          ],
          pathGroupsExcludedImportTypes: ["react"],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // ── Disabled/relaxed ──
      // Let TypeScript handle these:
      "no-undef": "off",
      "no-unused-vars": "off", // handled by @typescript-eslint/no-unused-vars

      // Pre-existing issues — warn instead of error to avoid blocking
      "no-useless-escape": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-useless-assignment": "warn",
    },
  },
);
