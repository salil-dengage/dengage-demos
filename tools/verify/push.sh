#!/usr/bin/env bash
# ============================================================================
# The safe way to land a change when several sessions share one branch.
#
#   DENGAGE_SESSION=finance tools/verify/push.sh      # NovaPay and Meridian
#   tools/verify/push.sh --session=ecomm
#   tools/verify/push.sh --session=fintech --dry-run  # everything except the push
#
# Use this INSTEAD OF `git push`. Commit your work first: this script does not
# commit for you, on purpose, because the commit message is yours to write.
#
# ---------------------------------------------------------------------------
# THIS FILE CONTAINED AN UNRESOLVED MERGE CONFLICT FROM 31 JULY UNTIL 2 AUGUST
# 2026, AND THE HALF THAT RAN WAS THE WRONG HALF.
#
# Two implementations were written independently, ef1ad73 ("merge before
# verifying") and 7dad0de ("a guarded push"). The merge in 5bbd3cc concatenated
# both and left a bare ======= marker between them. Bash parses that as a
# command word, so `bash -n` stayed happy and nothing ever complained. The
# first implementation exited before reaching it, so the second, the one this
# header and CLAUDE.md both describe, was dead code for two days.
#
# The practical effect: NO SESSION WAS MERGING BEFORE VERIFYING. Every push
# verified the unmerged tree and then pushed, which is exactly the failure the
# script exists to prevent, and it is why pushes kept losing four retries in a
# row to a moving origin/main: the retry loop re-pushed without re-merging, so
# once main moved it could never win.
#
# Resolved by keeping the merge-first implementation and porting the two things
# only the other one had: the file listing and the shared-file warning. Neither
# side was taken wholesale, per CLAUDE.md 1.
# ---------------------------------------------------------------------------
#
# What it does, in order:
#
#   1. Refuses to run with a dirty tree. An uncommitted file is a file the
#      verification result does not describe.
#   2. Fetches origin/main and MERGES IT IN FIRST.
#   3. Says plainly what it is about to deploy, and warns on shared files.
#   4. Checks the change stayed in the session's lane (ownership.js).
#   5. Works out the verification tier from the MERGED diff, not from what you
#      think you changed, and runs exactly those suites.
#   6. Pushes. If main moved while the suites were running, it starts again
#      from step 2 rather than pushing a tree nobody verified.
#
# The ordering is the whole point. Verifying and then merging proves nothing
# about what you push: a clean text merge of two correct changes can still be
# broken. That is not hypothetical here. On 31 July the concurrent test runner
# and a second session's work merged without a single conflict and the result
# was broken, because the runner now started three suites that each cleared one
# shared screenshot directory. Only a post-merge run could have caught it, and
# a post-merge run is what did.
# ============================================================================
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO" || exit 1

SESSION="${DENGAGE_SESSION:-}"
DRY=0
for a in "$@"; do
  case "$a" in
    --session=*) SESSION="${a#--session=}" ;;
    --dry-run)   DRY=1 ;;
    *) echo "unknown argument: $a"; exit 2 ;;
  esac
done

if [ -z "$SESSION" ]; then
  echo "Which session are you? Set DENGAGE_SESSION or pass --session="
  echo "  ecomm    | CantuPneus, and the five shared modules"
  echo "  finance  | NovaPay and Meridian, the usual one for either finance demo"
  echo "  fintech  | NovaPay only, when the change is meant to reach one site"
  echo "  banking  | Meridian only, likewise"
  exit 2
fi

say() { printf '\n=== %s\n' "$*"; }

# Which folders this session owns, for the informational shared-file note only.
# ownership.js remains the authority on what is actually allowed. Written as a
# grep alternation, so a session owning two demos lists both.
case "$SESSION" in
  ecomm)   SESSION_DIRS='cantu-pneus/' ;;
  finance) SESSION_DIRS='fintech/|banking/' ;;
  fintech) SESSION_DIRS='fintech/' ;;
  banking) SESSION_DIRS='banking/' ;;
  *)       SESSION_DIRS='' ;;
esac

# ---------------------------------------------------------------- 1. clean tree
if [ -n "$(git status --porcelain)" ]; then
  say "UNCOMMITTED CHANGES"
  git status --short
  echo
  echo "Commit or stash first. A file that is not in the commit is a file the"
  echo "verification result does not describe."
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "on branch '$BRANCH', expected 'main'. This repo works on main."
  exit 1
fi

attempt=0
while : ; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 3 ]; then
    say "GIVING UP AFTER 3 ATTEMPTS"
    echo "origin/main keeps moving while the suites run. Coordinate with the"
    echo "other sessions rather than racing them."
    exit 1
  fi

  # -------------------------------------------------------------- 2. merge first
  say "fetching origin/main (attempt ${attempt})"
  ok=0
  for i in 1 2 3 4; do
    git fetch origin main && { ok=1; break; }
    sleep $((2 ** i))
  done
  [ "$ok" = "1" ] || { echo "could not fetch after 4 tries"; exit 1; }

  BEFORE="$(git rev-parse origin/main)"

  if [ "$(git rev-parse HEAD)" != "$BEFORE" ] && \
     [ -n "$(git rev-list HEAD..origin/main)" ]; then
    say "merging origin/main into your work"
    if ! git merge --no-edit origin/main; then
      say "MERGE CONFLICT"
      git diff --name-only --diff-filter=U
      echo
      echo "Resolve by hand, then run this script again."
      echo
      echo "Resolve by KEEPING BOTH sides' intent. Never take one side wholesale:"
      echo "that is how one session silently reverts another's work, and it will"
      echo "not show up as a conflict next time because the revert is now history."
      exit 1
    fi
  else
    echo "already up to date with origin/main"
  fi

  # ------------------------------------------- 3. say what is being deployed
  CHANGED="$(git diff --name-only "$BEFORE" || true)"
  if [ -z "$CHANGED" ]; then
    say "nothing to push"
    exit 0
  fi
  say "files in this push"
  echo "$CHANGED" | sed 's/^/  /'

  # tools/verify and docs/ are shared, so a change there can affect every site.
  # ownership.js decides what is ALLOWED; this only makes it visible.
  OUTSIDE="$(echo "$CHANGED" | grep -vE "^(${SESSION_DIRS})" || true)"
  if [ -n "$OUTSIDE" ]; then
    echo
    echo "NOTE  this push also touches shared files:"
    echo "$OUTSIDE" | sed 's/^/        /'
    echo "NOTE  if these are suites or per-site config, confirm the other sites still pass."
  fi

  # ------------------------------------------------------------- 4. lane check
  say "ownership"
  if ! node tools/verify/ownership.js --session="$SESSION" --base="$BEFORE"; then
    exit 1
  fi

  # ------------------------------------------- 4. tier, from the MERGED diff
  TIER="$(node tools/verify/ownership.js --session="$SESSION" --base="$BEFORE" \
          | awk '/^run  /{ $1=""; sub(/^ +/,""); print; exit }')"

  say "verifying the merged tree"
  echo "tier: ${TIER}"

  # Per-site journey suites, for the branches that run everything.
  run_site_journey_suites() {
    for s in cantu-pneus fintech banking; do
      for suite in "$s"/tools/*test.js; do
        [ -e "$suite" ] || continue
        echo "running $suite"
        node "$suite" || return 1
      done
    done
  }

  case "$TIER" in
    "no browser suite"*)
      node -e '
        const fs=require("fs"),path=require("path");
        let bad=0;
        const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{
          if(e.name===".git")return[];
          const p=path.join(d,e.name);
          return e.isDirectory()?walk(p):(p.endsWith(".md")?[p]:[]);
        });
        for(const p of walk(".")){
          const t=fs.readFileSync(p,"utf8");
          t.split("\n").forEach((l,i)=>{
            if(l.includes("—")||l.includes("–")){console.log("DASH",p,i+1);bad++;}
          });
          for(const m of t.matchAll(/\]\((?!http|mailto)([^)\s]+)\)/g)){
            const tgt=m[1].split("#")[0];
            if(tgt&&!tgt.includes("\"")&&!fs.existsSync(path.join(path.dirname(p),tgt))){
              console.log("BROKEN",p,"->",tgt);bad++;
            }
          }
        }
        console.log(bad?`${bad} issue(s)`:"docs clean");
        process.exit(bad?1:0);
      ' || exit 1
      ;;
    "tools/verify/run.sh")
      tools/verify/run.sh || exit 1
      run_site_journey_suites || exit 1
      ;;
    "tools/verify/run.sh "*)
      # A site run. eComm changes can land in any of three site folders, so
      # derive the real list from the diff instead of trusting one name.
      SITES="$(git diff --name-only "$BEFORE" | node -e '
        const s=new Set(); let d="";
        process.stdin.on("data",c=>d+=c).on("end",()=>{
          for(const p of d.split("\n")){
            if(p.startsWith("cantu-pneus/en/")) s.add("cantu-pneus-en");
            else if(p.startsWith("cantu-pneus/ru/")) s.add("cantu-pneus-ru");
            else if(p.startsWith("cantu-pneus/")) s.add("cantu-pneus");
            else if(p.startsWith("fintech/")) s.add("fintech");
            else if(p.startsWith("banking/")) s.add("banking");
          }
          console.log([...s].join(" "));
        });')"
      [ -n "$SITES" ] || SITES="$(echo "$TIER" | awk '{print $2}')"
      for s in $SITES; do
        echo "--- $s"
        tools/verify/run.sh "$s" || exit 1
        # A site may carry its own suite for behaviour only it has. banking has
        # one: the five public journeys and the ten-card event panel, none of
        # which the shared suites know about.
        for suite in "$s"/tools/*test.js; do
          [ -e "$suite" ] || continue
          echo "running $suite"
          node "$suite" || exit 1
        done
      done
      ;;
    "node "*)
      # The mobile tier. ownership.js hands back the exact suites, already
      # filtered to the ones the site has, because it is the half of this pair
      # that knows how the diff was classified. Run them by name rather than
      # globbing <site>/tools/*test.js: that glob also catches the Playwright
      # journey suites, which need a served site an app change cannot affect.
      echo "running: $TIER"
      eval "$TIER" || exit 1
      ;;
    *paneltest*)
      node tools/verify/paneltest.js cantu-pneus || exit 1
      node tools/verify/paneltest.js fintech     || exit 1
      node tools/verify/formtest.js  cantu-pneus || exit 1
      node tools/verify/pttext.js    cantu-pneus || exit 1
      node tools/verify/rutext.js    cantu-pneus || exit 1
      ;;
    *)
      echo "could not read a tier from ownership.js, running everything"
      tools/verify/run.sh || exit 1
      run_site_journey_suites || exit 1
      ;;
  esac

  # ------------------------------------------------------------------ 5. push
  git fetch origin main >/dev/null 2>&1
  if [ "$(git rev-parse origin/main)" != "$BEFORE" ]; then
    say "origin/main moved while the suites ran, starting over"
    echo "The tree that passed is not the tree that would be pushed."
    continue
  fi

  if [ "$DRY" = "1" ]; then
    say "DRY RUN, not pushing"
    echo "verified and in lane. Drop --dry-run to land it."
    exit 0
  fi

  say "pushing"
  for i in 1 2 3 4; do
    if git push origin main; then
      say "LANDED"
      echo "commit: https://github.com/salil-dengage/dengage-demos/commit/$(git rev-parse --short HEAD)"
      exit 0
    fi
    # A rejection here means somebody landed between our check and our push.
    # Go round again rather than forcing: --force is how work disappears.
    git fetch origin main >/dev/null 2>&1
    if [ "$(git rev-parse origin/main)" != "$BEFORE" ]; then
      say "beaten to the push, starting over"
      break
    fi
    sleep $((2 ** i))
  done
done
