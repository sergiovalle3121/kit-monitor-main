import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // `eslint-plugin-react-hooks` v7 (eslint-config-next 16) añade las reglas del
    // React Compiler como ERROR; el código del repo es anterior y las incumple en
    // muchos sitios, así que romperían el lint por deriva de tooling. Se dejan como
    // avisos (sin bloquear), conservando `rules-of-hooks` y `exhaustive-deps`.
    rules: {
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);

export default eslintConfig;
