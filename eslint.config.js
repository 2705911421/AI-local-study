import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "artifacts/**",
      "build/**",
      "coverage/**",
      "dist/**",
      "dist-electron/**",
      "node_modules/**",
      "output/**",
      "public/release/**",
      "release/**",
      "test-results/**",
      ".openai/**",
      ".playwright-cli/**",
      ".playwright-mcp/**",
      ".reasonix/**",
      ".tmp-preview/**",
      "sites/.tmp-preview/**",
      ".tmp-pptx*/**",
      "scripts/__pycache__/**",
      ".wrangler/**",
      "vite.config.d.ts",
      "vite.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-control-regex": "off",
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["electron/**/*.cts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  prettier,
);
