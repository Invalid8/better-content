#!/usr/bin/env sh
set -e

current=$(git rev-parse --abbrev-ref HEAD)
if [ "$current" != "main" ]; then
  echo "Run this from main (currently on $current)." >&2
  exit 1
fi

git merge staging --no-commit --no-ff
git restore --source=HEAD --staged --worktree \
  examples/playground/package.json \
  examples/playground/package-lock.json
git commit --no-edit
echo "Merged staging into main; playground package files kept from main."
