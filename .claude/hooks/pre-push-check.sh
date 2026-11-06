#!/usr/bin/env bash
# PreToolUse hook on Bash: guards `git push`.
#
# Claude Code passes the pending tool call as JSON on stdin. Anything that is
# not a git push is let through untouched. For a push, the merchant console's
# tests and type-check build run first; if either fails, the hook exits 2,
# which blocks the push and hands stderr back to Claude as the reason.

set -uo pipefail

input=$(cat)
command=$(printf '%s' "$input" | node -e '
  let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
    try { process.stdout.write(JSON.parse(s).tool_input?.command ?? "") } catch { }
  })')

# Only guard pushes: `git push`, also after `cd … &&` or with `git -C dir push`.
if ! printf '%s' "$command" | grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]]|$)'; then
  exit 0
fi

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
app="$root/build-battle/merchant-console"
logdir="${TMPDIR:-/tmp}/northwind-pre-push"
mkdir -p "$logdir"

if [ ! -d "$app/node_modules" ]; then
  echo "pre-push check: no node_modules in $app. Run npm install there, then push again." >&2
  exit 2
fi

# Vite (used by vitest) needs Node >= 20.19. On an older Node, run the checks
# on Node 22 via npx rather than failing every push on a tooling mismatch.
node_ok=$(node -e 'const [a,b]=process.versions.node.split(".").map(Number); console.log(a>22||(a===22&&b>=12)||(a===20&&b>=19)||a===21?"yes":"no")')
if [ "$node_ok" = yes ]; then run_node=(node); else run_node=(npx -y node@22); fi

cd "$app" || exit 2

failed=()
if ! "${run_node[@]}" node_modules/vitest/vitest.mjs run >"$logdir/test.log" 2>&1; then
  failed+=("tests: see $logdir/test.log, or run npm test in build-battle/merchant-console")
fi
# Type-check rather than `next build`: a full build rewrites .next under a
# running dev server and breaks it. tsc covers what the build would reject.
if ! "${run_node[@]}" node_modules/typescript/bin/tsc --noEmit >"$logdir/build.log" 2>&1; then
  failed+=("build (tsc --noEmit): see $logdir/build.log")
fi

if [ ${#failed[@]} -gt 0 ]; then
  {
    echo "Push blocked by .claude/hooks/pre-push-check.sh. Failed:"
    printf '  - %s\n' "${failed[@]}"
    echo "Fix these and push again."
  } >&2
  exit 2
fi

exit 0
