#!/bin/sh
# Runs the full test suite. Adjust for this project's layout:
#   - single package:  the line below is enough
#   - workspaces:      run `npm test` in each workspace dir, e.g.
#                        for ws in backend frontend; do (cd "$ws" && npm test); done
set -e
echo "Running tests..."
npm test
echo "All tests passed."
