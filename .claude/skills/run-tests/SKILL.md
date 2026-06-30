---
name: run-tests
description: Always use this skill to run tests. Never construct custom test commands.
user-invokable: true
---
# Run tests skill

Always run tests using the script at `scripts/run-tests.sh`.
Never construct your own test commands — always use this script.
This script runs the full test suite.
Running a subset of tests is never acceptable unless explicitly asked.
