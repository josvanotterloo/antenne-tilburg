#!/bin/sh
# Runs the full test suite for this single-package project.
# `npm test` maps to `vitest run` (see package.json).
set -e
echo "Running tests..."
npm test
echo "All tests passed."
