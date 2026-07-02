import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

// ESLint 9 flat config. eslint-config-next@16 ships native flat-config arrays,
// so import them directly. `next lint` is deprecated in Next 16 — lint runs via
// the eslint CLI (see the "lint" script in package.json).
//
// next/core-web-vitals wires the @typescript-eslint plugin + parser but enables
// no TS rules, so we add tseslint's `recommended` set on top (react-hooks rules
// already come from next/core-web-vitals).
const eslintConfig = [
  ...nextCoreWebVitals,
  ...tseslint.configs.recommended,
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
