# Environment Gaps

Backlog of points where verification was handed to the human because it
couldn't be exercised in this environment. Append one line per gap at
close-out. Not a task list — don't fix these in the same session they're
logged.

| Date | Change | Could not verify | Why |
|---|---|---|---|
| 2026-09-17 | Authorization-boundary audit of `app/api/admin/**` (docs/instructions/authorization-boundaries.md) | That each route actually returns a live 401 for an unauthenticated request | Verified via static code reading (grep for `requireAdmin()` calls) and the existing automated test suite (mocked `auth()`), not by running the dev server and sending real unauthenticated HTTP requests against it |
