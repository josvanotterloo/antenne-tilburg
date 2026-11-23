import { describe, it, expect } from "vitest";
import {
  ALLOWLIST,
  evaluateAudit,
  extractAdvisoryIds,
  findAllowlistEntry,
  isExpired,
} from "./check-npm-audit.mjs";

// Shapes matching real `npm audit --omit=dev --json` output (captured
// directly from this repo's own dependency tree): a package can be the
// advisory's own subject (a real advisory object in `via`) or only
// affected transitively (a bare package-name string in `via`).
const deepmergeTsFinding = {
  severity: "high",
  via: [{ url: "https://github.com/advisories/GHSA-ggr8-5vv4-36mx" }],
};
const prismaConfigFinding = { severity: "high", via: ["deepmerge-ts", "effect"] };
const prismaFinding = { severity: "high", via: ["@prisma/config"] };
const effectFinding = {
  severity: "high",
  via: [{ url: "https://github.com/advisories/GHSA-7589-6fvf-x4pw" }],
};
// Not on the allowlist at all — used for the "unmapped" cases below, kept
// distinct from `effect` now that effect has its own entry.
const unlistedFinding = {
  severity: "high",
  via: [{ url: "https://github.com/advisories/GHSA-0000-aaaa-bbbb" }],
};

describe("extractAdvisoryIds", () => {
  it("pulls the GHSA id out of a real advisory object", () => {
    expect(extractAdvisoryIds(deepmergeTsFinding.via)).toEqual(["GHSA-ggr8-5vv4-36mx"]);
  });

  it("ignores bare package-name strings", () => {
    expect(extractAdvisoryIds(prismaConfigFinding.via)).toEqual([]);
  });

  it("returns an empty array for a non-array input", () => {
    expect(extractAdvisoryIds(undefined)).toEqual([]);
  });
});

describe("findAllowlistEntry", () => {
  it("matches an entry with a pinned advisoryId only when that id is present", () => {
    expect(findAllowlistEntry("deepmerge-ts", deepmergeTsFinding.via)).toBeDefined();
    expect(findAllowlistEntry("effect", effectFinding.via)).toBeDefined();
  });

  it("does not match a pinned-advisoryId entry against a different advisory on the same package", () => {
    const differentAdvisory = {
      via: [{ url: "https://github.com/advisories/GHSA-0000-0000-0000" }],
    };
    expect(findAllowlistEntry("deepmerge-ts", differentAdvisory.via)).toBeUndefined();
    expect(findAllowlistEntry("effect", differentAdvisory.via)).toBeUndefined();
  });

  it("matches a no-advisoryId entry by name alone (nothing to pin — no advisory of its own)", () => {
    expect(findAllowlistEntry("@prisma/config", prismaConfigFinding.via)).toBeDefined();
    expect(findAllowlistEntry("prisma", prismaFinding.via)).toBeDefined();
  });

  it("returns undefined for a package not on the allowlist at all", () => {
    expect(findAllowlistEntry("left-pad", unlistedFinding.via)).toBeUndefined();
  });
});

describe("isExpired", () => {
  const entry = { expires: "2027-01-31" };

  it("is not expired before its date", () => {
    expect(isExpired(entry, new Date("2026-11-23T00:00:00Z"))).toBe(false);
  });

  it("is not expired exactly on its date", () => {
    expect(isExpired(entry, new Date("2027-01-31T00:00:00Z"))).toBe(false);
  });

  it("is expired the day after its date", () => {
    expect(isExpired(entry, new Date("2027-02-01T00:00:00Z"))).toBe(true);
  });
});

describe("evaluateAudit", () => {
  function report(vulnerabilities) {
    return { vulnerabilities };
  }

  it("allowlists the four Prisma-cascade entries before their expiry", () => {
    const result = evaluateAudit(
      report({
        "deepmerge-ts": deepmergeTsFinding,
        "@prisma/config": prismaConfigFinding,
        prisma: prismaFinding,
        effect: effectFinding,
      }),
      new Date("2026-11-23T00:00:00Z"),
    );
    expect(result.blocking).toEqual([]);
    expect(result.expired).toEqual([]);
    expect(result.allowlisted.map(([name]) => name)).toEqual([
      "deepmerge-ts",
      "@prisma/config",
      "prisma",
      "effect",
    ]);
  });

  it("blocks a finding on a package that isn't on the allowlist at all", () => {
    const result = evaluateAudit(
      report({ "left-pad": unlistedFinding }),
      new Date("2026-11-23T00:00:00Z"),
    );
    expect(result.blocking.map(([name]) => name)).toEqual(["left-pad"]);
    expect(result.expired).toEqual([]);
  });

  it("blocks a DIFFERENT advisory on effect instead of silently allowlisting it", () => {
    const newEffectAdvisory = {
      severity: "high",
      via: [{ url: "https://github.com/advisories/GHSA-9999-9999-9999" }],
    };
    const result = evaluateAudit(
      report({ effect: newEffectAdvisory }),
      new Date("2026-11-23T00:00:00Z"),
    );
    expect(result.blocking.map(([name]) => name)).toEqual(["effect"]);
    expect(result.allowlisted).toEqual([]);
  });

  it("treats an expired entry as expired, not as blocking or allowlisted", () => {
    const result = evaluateAudit(
      report({ "deepmerge-ts": deepmergeTsFinding, effect: effectFinding }),
      new Date("2027-02-01T00:00:00Z"),
    );
    expect(result.blocking).toEqual([]);
    expect(result.allowlisted).toEqual([]);
    expect(result.expired).toHaveLength(2);
    expect(result.expired.map(([name]) => name).sort()).toEqual(["deepmerge-ts", "effect"]);
  });

  it("ignores moderate/low severity findings entirely", () => {
    const result = evaluateAudit(
      report({ glob: { severity: "moderate", via: [] } }),
      new Date("2026-11-23T00:00:00Z"),
    );
    expect(result.blocking).toEqual([]);
    expect(result.expired).toEqual([]);
    expect(result.allowlisted).toEqual([]);
  });
});

describe("the real ALLOWLIST", () => {
  it("has the four Prisma-cascade entries expiring 2027-01-31", () => {
    for (const pkg of ["deepmerge-ts", "@prisma/config", "prisma", "effect"]) {
      const entry = ALLOWLIST.find((e) => e.package === pkg);
      expect(entry).toBeDefined();
      expect(entry.expires).toBe("2027-01-31");
    }
  });

  it("pins effect to its real advisory id", () => {
    const entry = ALLOWLIST.find((e) => e.package === "effect");
    expect(entry.advisoryId).toBe("GHSA-7589-6fvf-x4pw");
  });

  it("is not yet expired as of today", () => {
    for (const entry of ALLOWLIST) {
      expect(isExpired(entry)).toBe(false);
    }
  });
});
