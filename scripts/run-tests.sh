#!/usr/bin/env bash
# Canonical test entry point — referenced by .claude/skills/run-tests/SKILL.md.
# Always runs the full suite; never pass a subset filter.
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
