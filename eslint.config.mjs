import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import a11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

// The strict accessibility rules this codebase does not pass yet. Each one
// warns, so CI shows it without failing; move a rule back to "error" once its
// warnings are fixed. Every other strict rule is already an error.
const A11Y_NOT_YET_CLEAN = [
  "jsx-a11y/label-has-associated-control",
  "jsx-a11y/no-autofocus",
  "jsx-a11y/no-noninteractive-tabindex",
  "jsx-a11y/interactive-supports-focus",
  "jsx-a11y/no-static-element-interactions",
  "jsx-a11y/no-noninteractive-element-interactions",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    // Type-aware rules: a promise nobody awaits is an error that vanishes.
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      ...a11y.flatConfigs.strict.rules,
      ...Object.fromEntries(A11Y_NOT_YET_CLEAN.map((rule) => [rule, "warn"])),
      "@typescript-eslint/no-floating-promises": "error",
      // An async onClick is the ordinary React pattern; every other place a
      // promise lands where a void is expected is still an error.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the app: the Python backend and the generated graph.
    "backend/**",
    "graphify-out/**",
  ]),
]);

export default eslintConfig;
