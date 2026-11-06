---
name: northwind-pr
description: Write a pull request title and description for the current branch in the Northwind team's required format, from the branch diff, the git log, and the ticket. Use when the user asks to write, draft, or update a PR description, or invokes /northwind-pr. Writes the description only; it never pushes or opens the pull request.
---

# /northwind-pr

Write the pull request title and description for the work on this branch, in the team's required format.

Every sentence in the description has to be traceable to one of four sources: the diff, the git log, the ticket, or the output of a command that was actually run. If a claim cannot be traced, it does not go in.

## What to do

### 1. Read before writing anything

Do all of this before drafting a single line.

- `git branch --show-current`. The ticket ID is the prefix of the branch name: `NWP-101-export-options` is `NWP-101`. If the branch carries no ticket ID, ask the user which ticket it is.
- `git diff main...HEAD --stat`, then `git diff main...HEAD`. This is what actually changed, not what was intended.
- `git log main..HEAD --oneline`. How the work was sequenced.
- `docs/tickets/<TICKET-ID>.md`. Copy the acceptance criteria exactly as written, and note anything the ticket marks out of scope.

If the diff is empty, stop and tell the user there is nothing to describe.

### 2. Collect the verification evidence

List the commands that were actually run for this change, with what they printed. Evidence counts only if it is one of these:

- a command run in this session whose output you saw, such as `npm test`, `npm run lint`, or a `curl` against the dev server
- a command whose output you run now and quote, after asking the user whether to run it
- output the user pasted, credited to the user

Copy the meaningful line of output, for example `Tests  37 passed (37)`. Do not round it into "tests pass". If something was checked in a browser, say what was clicked and what appeared, and who did the clicking.

If there is no evidence for a step, that step was not verified. Say so in the description. Never write it as done.

### 3. Check each acceptance criterion against the diff

Go one criterion at a time. Find the code in the diff that meets it.

- **Met**: tick it.
- **Partial**: leave it unticked, and say which part is done and which is not.
- **Not met**: leave it unticked, and say so.

Do not tick a criterion because it was intended, planned, or "should work".

### 4. Write the description

Use exactly this format:

```markdown
<TICKET-ID>: <what it does>

## What changed

One paragraph in plain language. What can someone do now that they could not do before? No file list; the diff already is one.

## How I verified it

- `<command>`: <what it printed>
- In the browser at <page>: clicked <what>, saw <what>

## Acceptance criteria

- [x] <criterion, copied from the ticket>
- [ ] <criterion>: partial. <what is done, and what is not>

## Deliberately not done

- <out-of-scope item or follow-up, and why it was left>
```

- **Title**: `<TICKET-ID>: <what it does>`, in plain words, with no trailing period. For example: `NWP-101: add export options`.
- **Deliberately not done**: anything out of scope, left for a follow-up, or found and not fixed. If nothing was left out, write "Nothing deliberately left out." rather than dropping the section.

### 5. Hand it back

Print the title and the description. Offer to save the description to a file for `gh pr create --body-file`, or for `/submit`.

Do not push, open, or edit the pull request yourself. That is the user's call.

## Rules

- **Never claim a verification step that was not actually run.** Not "should pass", not "verified locally" without the output, not a checkbox for something nobody did. This is the rule that matters most.
- **Read first, write second.** No draft until the diff, the log, and the ticket have been read.
- **Plain language.** "Ops can now choose which columns go into the export" beats "implemented configurable export column functionality".
- **Honest checkboxes.** A partial criterion is reported as partial, with which half is done.
- **Say what was left out.** A stated limit reads as judgment. A limit the reviewer finds on their own reads as a mistake.
- **No placeholders left behind**, no emoji, no summary of the summary.
