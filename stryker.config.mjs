/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  // Mutate only lib/'s pure, framework-free core — app/ and components/
  // are excluded per instruction (UI mutation testing is too noisy).
  mutate: [
    "lib/catalog.ts",
    "lib/email/render.ts",
    "lib/token.ts",
    "lib/authorize.ts",
    "lib/blog.ts",
    "lib/notice.ts",
    "lib/rss.ts",
  ],
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
};

export default config;
