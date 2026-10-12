#!/usr/bin/env node
// CRAP (Change Risk Analyzer and Predictor) report for a source directory.
// CRAP = complexity^2 * (1 - coverage)^3 + complexity, the formula from
// crap4java/crap4clj/crap4go (see github.com/unclebob/crapper). We compute
// it ourselves instead of running that tool directly: it would run `npm
// install` and our test suite as a subprocess of a freshly-cloned,
// unreviewed script. This covers the same ground — TypeScript's own
// compiler API for cyclomatic complexity, Vitest's own v8 coverage for the
// coverage fraction — using tooling already in this project's trust
// boundary.
//
// Usage: node scripts/crap-report.mjs [dir]   (default: lib)

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const TARGET_DIR = process.argv[2] ?? "lib";
const COVERAGE_DIR = ".metrics/coverage";
const EDN_PATH = ".metrics/crap.edn";

const DECISION_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CaseClause,
]);

const DECISION_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function isTestFile(path) {
  return /\.(test|spec)\.[tj]sx?$/.test(path);
}

function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      files.push(...listSourceFiles(full));
      continue;
    }
    if ([".ts", ".tsx"].includes(extname(entry)) && !isTestFile(full)) {
      files.push(full);
    }
  }
  return files;
}

function runCoverage(files) {
  mkdirSync(COVERAGE_DIR, { recursive: true });
  const args = [
    "vitest",
    "run",
    "--coverage",
    "--coverage.provider=v8",
    "--coverage.reporter=lcov",
    `--coverage.reportsDirectory=${COVERAGE_DIR}`,
    "--coverage.reportOnFailure=true",
  ];
  for (const file of files) {
    args.push(`--coverage.include=${relative(ROOT, file)}`);
  }
  const result = spawnSync("npx", args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    console.error("vitest coverage run failed; aborting.");
    process.exit(result.status ?? 1);
  }
}

function parseLcov(path) {
  const text = readFileSync(path, "utf8");
  const perFile = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      current = new Map();
      perFile.set(line.slice(3).trim(), current);
    } else if (line.startsWith("DA:") && current) {
      const [lineNo, hits] = line.slice(3).split(",");
      current.set(Number(lineNo), Number(hits));
    }
  }
  return perFile;
}

function complexityOf(node) {
  let cc = 1;
  function visit(n) {
    if (DECISION_KINDS.has(n.kind)) {
      cc++;
    } else if (ts.isBinaryExpression(n) && DECISION_OPERATORS.has(n.operatorToken.kind)) {
      cc++;
    } else if (
      (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n)) &&
      n.questionDotToken
    ) {
      cc++;
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return cc;
}

function lineRangeOf(sourceFile, node) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
  return [start, end];
}

// Entries: top-level function declarations, class methods/constructors, and
// top-level arrow/function-expression variables — the same cut crapper's
// TypeScript rules use. Anything nested inside one of those (helper
// closures, inline callbacks) is charged to the enclosing entry, not split
// out on its own.
function entriesOf(filePath) {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const moduleName = relative(ROOT, filePath).replace(/\.tsx?$/, "").split("/").join(".");
  const entries = [];

  const addEntry = (namespace, name, node) => {
    const [start, end] = lineRangeOf(sourceFile, node);
    entries.push({ file: relative(ROOT, filePath), namespace, name, start, end, complexity: complexityOf(node) });
  };

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      addEntry(moduleName, statement.name ? statement.name.text : "default", statement);
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      const className = statement.name.text;
      for (const member of statement.members) {
        if (ts.isConstructorDeclaration(member) && member.body) {
          addEntry(`${moduleName}.${className}`, "constructor", member);
        } else if (ts.isMethodDeclaration(member) && member.body && ts.isIdentifier(member.name)) {
          addEntry(`${moduleName}.${className}`, member.name.text, member);
        }
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) &&
          ts.isIdentifier(decl.name)
        ) {
          addEntry(moduleName, decl.name.text, decl.initializer);
        }
      }
    }
  }
  return entries;
}

function coverageOf(entry, lcovForFile) {
  if (!lcovForFile) return 1; // file absent from the report: nothing executable was found in it
  let covered = 0;
  let total = 0;
  for (const [lineNo, hits] of lcovForFile) {
    if (lineNo >= entry.start && lineNo <= entry.end) {
      total++;
      if (hits > 0) covered++;
    }
  }
  if (total === 0) return 1; // no DA records landed in range: trivial entry, nothing to cover
  return covered / total;
}

function crapOf(complexity, coverage) {
  return complexity ** 2 * (1 - coverage) ** 3 + complexity;
}

function writeEdn(entries) {
  const body = entries
    .map(
      (e) =>
        `{:name "${e.name}" :namespace "${e.namespace}" :complexity ${e.complexity} ` +
        `:coverage ${(e.coverage * 100).toFixed(1)} :crap ${e.crap.toFixed(1)}}`,
    )
    .join("\n            ");
  writeFileSync(EDN_PATH, `{:entries [${body}]}\n`);
}

function formatTable(entries) {
  const header = ["CRAP", "CC", "Cov%", "File", "Entry"];
  const rows = entries.map((e) => [
    e.crap.toFixed(1),
    String(e.complexity),
    (e.coverage * 100).toFixed(0),
    e.file,
    e.name,
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [line(header), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
}

const targetDir = join(ROOT, TARGET_DIR);
const files = listSourceFiles(targetDir);
if (files.length === 0) {
  console.log(`No source files under ${TARGET_DIR}.`);
  process.exit(0);
}

runCoverage(files);
const lcov = parseLcov(join(COVERAGE_DIR, "lcov.info"));

const entries = [];
for (const file of files) {
  const relPath = relative(ROOT, file);
  const lcovForFile = lcov.get(relPath);
  for (const entry of entriesOf(file)) {
    const coverage = coverageOf(entry, lcovForFile);
    entries.push({ ...entry, coverage, crap: crapOf(entry.complexity, coverage) });
  }
}

entries.sort((a, b) => b.crap - a.crap);
writeEdn(entries);
console.log(formatTable(entries));
console.error(`\nWrote ${EDN_PATH} (${entries.length} entries)`);
