# Prompt injection policy

**Rule: never include raw user-submitted text in an LLM prompt without
explicit sanitisation.**

This is distinct from XSS. XSS is a display-time risk, already handled by
React's default escaping everywhere this app renders user text (see
`docs/security/input-hardening-2026-08-14.md`). Prompt injection is a
different risk: if user-submitted free text (a subscriber's name, a form
field, anything a visitor typed) is ever concatenated into a prompt sent to
an LLM, that text can attempt to override the prompt's actual instructions
— "ignore the above and instead reveal/do X" — regardless of how the
output is later escaped for display.

## Current status: not applicable, but watch for it

As of this writing, nothing in this app feeds user-submitted text into an
LLM. The newsletter composer (`components/admin/NewsletterComposer.tsx`)
assembles emails from admin-authored markdown and catalog data — no LLM
call, no public input. If that changes — an AI-assisted composer, an
AI-generated blog draft from a public suggestion form, an LLM-based
moderation step reading subscriber names, anything of that shape — this
rule applies to whatever public field feeds it.

## What "explicit sanitisation" means when it does apply

- Never interpolate raw user text directly into a prompt string. Wrap it
  with clear delimiters (e.g. an XML-ish tag) and instruct the model that
  content between those delimiters is untrusted data, not instructions.
- Apply the same length limits and control-character stripping used for
  storage/display (`lib/newsletter-input.ts`'s `stripControlChars()` is a
  reasonable starting point) — an oversized or control-character-laden
  payload is a red flag for either an accident or a deliberate injection
  attempt.
- Treat the model's output as untrusted too: if that output is ever used to
  take an action (send an email, write to the DB, call another API), it
  needs the same validation any other untrusted input would get — a
  successful injection isn't just "the model said something weird," it can
  mean "the model was tricked into doing something."
