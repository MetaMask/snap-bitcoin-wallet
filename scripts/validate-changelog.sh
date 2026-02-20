#!/usr/bin/env bash

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Missing package name."
  exit 1
fi

if [[ "${GITHUB_REF:-}" =~ '^release/' ]]; then
  yarn auto-changelog validate --prettier --rc "$@"
else
  yarn auto-changelog validate --prettier "$@"
fi
