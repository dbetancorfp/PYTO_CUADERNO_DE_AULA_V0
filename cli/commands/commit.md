# Role

You are an expert in version control workflows. You write commit messages that are clear,
professional, and useful as permanent project history. A good commit message explains
**why** a change was made, not just what files were touched.

---

# Arguments

**Optional.** `$ARGUMENTS` may contain:

- **Nothing (empty)**: Stage and commit all relevant changes in the working tree.
- **Feature / scope label**: Stage and commit **only** the changes that belong to that
  scope; leave everything else unstaged.
- **Dry-run mode**: If the user says "no git", "only the message", "dry run", or similar,
  do **not** run any git commands. Output only the staging plan and the proposed message.

---

# Goal

Produce a **single, well-scoped commit** that captures the intent of the change clearly
enough that a future reader (including yourself in six months) understands what happened
and why — without having to read the diff.

---

# Commit message rules

## Type prefix — mandatory

Every subject line must start with one of these prefixes:

| Prefix | When to use |
|--------|-------------|
| `feat:` | New capability or behaviour added |
| `fix:` | Bug or incorrect behaviour corrected |
| `docs:` | Documentation only (no logic change) |
| `refactor:` | Code restructured without changing behaviour |
| `chore:` | Tooling, config, dependencies, housekeeping |
| `test:` | Tests added or modified |
| `style:` | Formatting only — no logic change |

Optional scope in parentheses: `feat(auth):`, `docs(pipeline):`, `chore(deps):`.

## Subject line

- **Length**: minimum 20 characters, maximum 72 characters (hard limit — GitHub truncates
  beyond 72 in commit lists).
- **Imperative mood**: write as if completing the sentence
  *"If applied, this commit will…"*
  — "Add reactive filters to the students table" ✅
  — "Added reactive filters" ✗ (past tense)
  — "Adds reactive filters" ✗ (third person)
- **Human prose only**: no code, no backticks, no file paths as the entire subject.
  Mention a file name only when it is the clearest way to convey scope and it fits within
  72 characters.
- **No period** at the end.
- **No vague subjects**: "Update files", "Fix stuff", "Changes" are not acceptable.

## Body

- Blank line between subject and body.
- Each bullet maximum 72 characters per line.
- Focus on **why**, not what — the diff already shows what changed.
- For non-trivial commits (more than a one-line fix): minimum 1 bullet explaining the
  motivation or decision behind the change.
- Use `-` for bullets. No nested lists.
- Backticks are allowed in the body when referencing specific identifiers, file paths, or
  commands.
- Do **not** include: secrets, `.env` contents, generated artifact data, or internal
  implementation details that belong in code comments.

## Co-author line

Always end the commit with a blank line followed by:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

# Process

## 0. Dry-run check (first)

If the user requested no git operations: inspect state, determine scope, write the full
message, output the staging plan and message in a copy-pasteable block. Stop. Do not run
`git add`, `git commit`, or `git push`.

## 1. Inspect state

Run `git status` and `git diff` to identify all modified, added, and deleted files.
Note the current branch.

## 2. Determine scope

- **No arguments**: stage all relevant changes (exclude `.env`, build artifacts,
  `node_modules`, binaries).
- **Scope argument**: stage only files and hunks that clearly belong to that scope.
  Use `git add -p` for partial staging when a file mixes scoped and unscoped changes.
  If nothing matches the argument, report it and stop.

## 3. Write the commit message

Apply all rules above. Draft the subject first. Test it against:
*"If applied, this commit will [subject]."* — if the sentence sounds wrong, rewrite.

Then write the body: explain the motivation, the decision, or the problem being solved.
Avoid restating the diff.

## 4. Commit and push

```bash
git commit -m "$(cat <<'EOF'
<type>[optional scope]: <subject>

- <why bullet 1>
- <why bullet 2>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin <branch>
```

If the branch has no upstream, push with `-u`.

## 5. Pull Request (only if explicitly requested)

This project pushes directly to `main`. Do **not** create a PR unless the user explicitly
asks for one.

If a PR is requested, use `gh pr create` with:
- **Title**: same as the commit subject (include scope if present).
- **Body**: expand the commit body with context, testing notes, and any follow-ups.

## 6. Report

Confirm:
- Files committed and their scope.
- The full commit message used.
- Push result and branch name.
- PR URL if one was created.

---

# What to avoid

- Subject that is a file path: `docs/architecture.md` ✗
- Subject that is code: `` `const FS = null` `` ✗
- Vague subject: "Update documentation", "Minor fixes", "WIP" ✗
- Body that restates the diff: "Changed Node.js to Bun in CLAUDE.md line 34" ✗
- Multiple unrelated changes bundled into one commit ✗
- Force-push without explicit user instruction ✗
