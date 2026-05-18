# ResaleIQ — Git Workflow

Branching strategy, merge process, and recovery procedures for the ResaleIQ
repository.

---

## Branch Strategy

```
main                          ← production branch; Vercel auto-deploys on push
  └── claude/resaleiq-platform-QTra1   ← current development branch (Claude Code sessions)
  └── feature/<name>          ← feature branches (short-lived, merge to main)
  └── fix/<name>              ← hotfix branches (merge to main, tag if needed)
```

### Branch Rules

| Branch | Purpose | Direct Push | PR Required |
|---|---|---|---|
| `main` | Production | Not recommended | Yes (unless solo dev) |
| `claude/resaleiq-platform-QTra1` | Active development | Yes | No |
| `feature/*` | New features | Yes | Yes (before merging to main) |
| `fix/*` | Hotfixes | Yes | Yes (before merging to main) |

---

## Standard Development Workflow

### Day-to-day (solo development)

```bash
# Start on the development branch
git checkout claude/resaleiq-platform-QTra1
git pull origin claude/resaleiq-platform-QTra1

# Make changes, then:
npm run typecheck    # must pass
npm run build        # must pass

git add <specific files>    # never use -A without reviewing what's staged
git commit -m "feat: description of what and why"
git push -u origin claude/resaleiq-platform-QTra1

# When ready to ship to production:
git checkout main
git merge claude/resaleiq-platform-QTra1 --no-ff
git push origin main
git checkout claude/resaleiq-platform-QTra1   # continue developing
```

### Feature branch workflow (for larger changes)

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature

# ...develop, commit...

git checkout main
git merge feature/my-feature --no-ff -m "feat: merge my-feature"
git push origin main
git branch -d feature/my-feature
```

---

## Commit Message Convention

Follow conventional commits — they make the git log scannable:

```
feat:     new feature (visible to users)
fix:      bug fix
refactor: code change with no behavior change
docs:     documentation only
chore:    dependency update, config change, tooling
test:     adding or fixing tests
```

Examples:
```
feat: add audit lead scoring engine
fix: correct JSX syntax in recovery-audit page
refactor: centralize supabaseConfigured check in lib/env
docs: add deployment guide and repository audit
chore: regenerate lockfile to match next@16.2.6
```

---

## Pre-Push Checklist

Before every `git push` to `main` or opening a PR:

```bash
npm ci                  # verify lockfile is clean
npm run typecheck       # zero TypeScript errors
npm run build           # zero build errors
npm run lint            # address lint warnings
```

---

## Hotfix Flow

For production bugs that need immediate fixing:

```bash
git checkout main
git pull origin main
git checkout -b fix/description

# Make the minimal targeted fix
npm run typecheck && npm run build   # must pass

git add <specific files>
git commit -m "fix: description of what was broken and why this fixes it"
git push -u origin fix/description

# Merge to main immediately (no staging needed for hotfixes)
git checkout main
git merge fix/description --no-ff
git push origin main

# Sync development branch
git checkout claude/resaleiq-platform-QTra1
git merge main
git push origin claude/resaleiq-platform-QTra1
```

---

## Recovering from Drift Between Local and Remote

### Local is behind remote (someone pushed)

```bash
git fetch origin
git log --oneline HEAD..origin/main   # see what you're missing
git pull origin main                  # fast-forward if possible
# If conflicts: resolve them, then git add + git commit
```

### Remote is behind local (push failed or was skipped)

```bash
# Verify what's unpushed
git log --oneline origin/main..HEAD
# Just push
git push origin main
```

### Local and remote have diverged (both have unique commits)

This typically happens after:
- Emergency MCP push (bypasses normal git)
- Force push by someone else
- Direct GitHub edits

```bash
git fetch origin
git log --oneline --graph HEAD origin/main   # visualize the divergence

# Option A: Merge (preserves full history)
git merge origin/main --no-ff

# Option B: Rebase (linear history, preferred for feature branches)
git rebase origin/main

git push origin main    # after merge or rebase
```

### After an MCP push bypassed local git

When files were pushed directly to GitHub via MCP tools (GitHub API), the local
repository won't have those commits:

```bash
git fetch origin main
git status   # shows local is behind
git reset --hard origin/main   # WARNING: discards any local uncommitted changes
# OR
git rebase origin/main   # if you have local commits to preserve
```

---

## What to NEVER Do

| Action | Why it's dangerous |
|---|---|
| `git push --force origin main` | Overwrites production history. Use `--force-with-lease` if absolutely needed. |
| `git reset --hard origin/main` without verifying local changes | Silently discards uncommitted work. Always `git stash` first. |
| `git commit -a` without reviewing what's staged | Can accidentally commit `.env.local`, `.next/`, or debug code |
| `npm audit fix --force` | Currently would downgrade to Next.js 9.x |
| Editing files directly on GitHub for large changes | Creates drift from local; use for documentation only |
| Committing `node_modules/` | Already gitignored; don't remove `.gitignore` entry |
| Committing `.env.local` | Already gitignored; contains real Supabase keys |

---

## Large File Push Issues

The local git proxy (127.0.0.1) has historically blocked pushes with payloads
exceeding ~290KB. `package-lock.json` (~297KB) is the most common file to hit
this limit.

**Current status (post-Phase 2):** The lockfile was successfully regenerated and
pushed via git push. If future lockfile regeneration creates a file larger than
the proxy can handle:

1. Try `git push` — it may succeed if the payload compresses below the limit
2. If blocked with HTTP 503, use the GitHub MCP `push_files` tool to push the
   file directly via the GitHub API
3. After an MCP push, sync local: `git fetch origin && git reset --hard origin/main`

To check current lockfile size:
```bash
wc -c package-lock.json
```

Files over ~290KB may need MCP-assisted push in this environment.

---

## Repository Health Checks

Run periodically to catch drift:

```bash
# Verify lockfile matches package.json
npm ci --dry-run 2>&1 | grep -E "error|Invalid|Missing"

# Check for unpushed commits
git log --oneline origin/main..HEAD

# Check for stale branches
git branch -a --merged main | grep -v "main$"

# Audit security
npm audit

# Verify build still works
npm run typecheck && npm run build
```
