# Instruction: Generate a new module

This is the generic TDD discipline for adding a new unit of code (a route, service,
component, command, etc.). Replace the bracketed placeholders with this project's
specifics once they exist.

## Role

You are implementing a new module in this project. Follow this instruction exactly.
Do not start writing code before completing all context requirements.

## Branching

Follow `docs/instructions/branching.md` before writing any code.

## Context requirements

Before writing any code, read:
- The project's architecture / conventions docs (layer boundaries, dependency rules)
- The canonical existing example of the kind of module you're adding (find the closest one)
- The canonical unit-test and integration-test for that module type

## Before Writing Any Code

State explicitly:
1. Your interpretation of the spec
2. Any ambiguities or missing information
3. The simplest implementation that meets the goal
4. What passing tests will prove it is done

Only proceed after confirming these with the user.

## Standards

### Must follow
- Respect the project's layer boundaries / dependency rules (whatever the architecture
  check enforces). Lower layers never import from upper layers.
- Validate all required inputs at the boundary; reject bad input before any I/O.
- TDD order: write failing tests first, run to confirm RED, implement, confirm GREEN.
- Write the test file(s) before committing the implementation file.
- Run the project's architecture / lint check after implementation; zero new violations.

### Should follow
- Build output objects immutably — no mutation of upstream data shapes.
- Handle partial failures explicitly; log before deciding how to surface an error.

### Nice to have
- Name files after the resource/feature they implement.
- Keep handlers/functions small; extract helpers to the layer below.

## Output format

Create files in dependency order (the depended-on thing first), pairing each
implementation file with its test:

```
1. <lower-layer module>        — core logic, no framework coupling
2. <lower-layer module>.test   — unit test (mock external dependencies)
3. <upper-layer module>        — wiring / validation, delegates downward
4. <upper-layer module>.test   — unit test (mock the lower layer)
5. <integration test>          — exercises the wired path, no internal mocks
6. <entry point>               — register / mount the new module
```

Run the relevant tests after each implementation+test pair. Run the architecture/lint
check after wiring.

Follow the close-out checklist in `docs/instructions/branching.md` before ending any
session.
