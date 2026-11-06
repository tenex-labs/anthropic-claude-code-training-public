---
name: northwind-pr
description: Write a pull request description in the Northwind team's required format (Marcus's house format) for the work on a branch. Use whenever the user asks to write, draft, fix, or redo a PR description, says a PR was bounced over its description, invokes /northwind-pr, or is about to run gh pr create in this repository.
---

# /northwind-pr

Write the pull request description for a branch, in the format Marcus asks for on every Northwind PR. He bounces PRs over the description alone, so the format is not optional and every claim in it has to be true.

The user may name a branch (`/northwind-pr NWP-101-export-options`). Without one, use the current branch. Worktrees share one repository, so a branch checked out in another worktree is still readable here: use `git diff main...<branch>` and `git log main..<branch>`, never a checkout.

## What to do

### 1. Gather the facts before writing a word

- `git log main..<branch> --oneline` for what was committed and in what order.
- `git diff main...<branch> --stat`, then the diff itself, for what actually changed.
- The ticket: take the ID from the branch name (`NWP-101-…` → `docs/tickets/NWP-101.md`) and read it, including the acceptance criteria and the notes at the bottom.
- The spec in `docs/specs/`, if one exists for the ticket, to see where the build departed from the plan.
- The conversation so far, for what was actually run: test output, commands, what was clicked in the browser.

If there is no ticket ID in the branch name, ask for it. Do not invent one.

### 2. Sort every verification claim into ran or did not run

For each thing you might write under "How I verified it", find the evidence in this session: the command and its output, or the click and what appeared. Anything without evidence is not a verification. It goes under "Deliberately not done" as not verified, or it is left out.

If the tests were not run in this session, run `npm test` in `build-battle/merchant-console` now and quote its summary line, or write that they were not run. Never write "tests pass" from memory or from intent.

### 3. Check each acceptance criterion against the diff

Copy the ticket's checkboxes word for word. For each one, find the code that meets it.
- Met: tick it.
- Partly met: leave it unticked and add a note on which half is done.
- Not met: leave it unticked and say so.

### 4. Write it in this format, nothing more, nothing less

```markdown
Title: <TICKET-ID>: <what it does, in plain words>

## What changed
One paragraph in plain language. What can ops or the user do now that they could not before? Not a list of files.

## How I verified it
- `<command>`: <the output, quoted, e.g. the vitest summary line>
- In the browser: <what was clicked> → <what appeared>

## Acceptance criteria
- [x] <criterion copied from the ticket>
- [ ] <criterion> (partial: <what is done, what is not>)

## Deliberately not done
- <out of scope, left for a follow-up, or not verified, each with a reason>
```

If the repository's `.github/pull_request_template.md` asks for more sections (Ticket, Bugs fixed along the way, Notes for the reviewer), keep them too, because the grader reads the template. Marcus's sections come first and are never dropped.

### 5. Hand it over; do not publish it

Print the title and the description, and save the body to a file. Offer the command, and run it only if the user says so:

- new PR: `gh pr create --title "<title>" --body-file <file>`
- existing PR: `gh pr edit <number> --title "<title>" --body-file <file>`

Opening or editing a PR is the user's call.

## Rules

- **Never claim a verification step that was not actually run.** This is the rule Marcus bounces PRs over. A gap you admit costs less than a check you invented, because he finds both.
- **The title is `<TICKET-ID>: <what it does>`.** Not the branch name, not "Fix stuff".
- **"What changed" is one paragraph** in the words ops would use. The diff is already the file list.
- **Quote real output.** "`npm test`: Tests 38 passed (38)" is evidence. "All tests green" is not.
- **Tick criteria honestly.** Partial means unticked, with a note.
- **Say what you did not do.** Out of scope, follow-ups, things not checked.
- No emoji, no filler, no closing summary.
