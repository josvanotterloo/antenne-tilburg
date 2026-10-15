/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  // Mutate all of lib/ — app/ and components/ stay excluded per instruction
  // (UI mutation testing is too noisy to act on). A glob, not a curated file
  // list: every new lib/ file is covered automatically, no manual edit
  // needed here when functionality is added. If a specific lib/ file ever
  // needs excluding (e.g. a thin framework singleton with nothing
  // meaningful to mutate), add a "!lib/..." negation line below with a
  // comment explaining why.
  mutate: ["lib/**/*.ts", "!lib/**/*.test.ts"],
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
};

export default config;
