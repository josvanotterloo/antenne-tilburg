import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// ESLint 9 flat config. eslint-config-next@16 ships native flat-config arrays,
// so import them directly. `next lint` is deprecated in Next 16 — lint runs via
// the eslint CLI (see the "lint" script in package.json).
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
