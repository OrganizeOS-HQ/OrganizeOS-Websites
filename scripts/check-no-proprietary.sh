#!/usr/bin/env bash
#
# OrganizeOS AGPL-only fork guard (docs/ORGANIZEOS-FORK.md section 2).
#
# The upstream @webstudio-is/sdk-components-animation package is EULA-proprietary
# and was physically removed from this fork. This guard keeps it out of what
# ships (owner decision D6, 2026-11-01):
#
#   1. the package directory does not exist;
#   2. no package.json names it: the workspace packages, the CLI site templates
#      (a template that lists it makes every published site install the EULA
#      package from npm) and the fixtures; nor does .gitmodules;
#   3. no module specifier in the source of apps/ or packages/ names it: no
#      import, export, require or dynamic import, and no quoted specifier such
#      as an alias or the component registry's import source, which becomes
#      the import in every generated site;
#   4. pnpm-lock.yaml has no entry for it;
#   5. the proprietary EULA license banner appears nowhere we ship.
#
# Prose and test names may mention the package, for example a persisted
# component id such as "@webstudio-is/sdk-components-animation:AnimateChildren".
#
# Run by `pnpm check:no-proprietary` and in CI. Exit non-zero on any hit.
# Self-test: packages/cli/scripts/check-no-proprietary.test.ts.
set -euo pipefail

cd "$(dirname "$0")/.."

name="sdk-components-animation"
fail=0

report() {
  echo "ERROR: $1" >&2
  fail=1
}

# Runs grep with its matches on stderr. Exit 0 means found, 1 means not found;
# anything else is an error, which must fail the check rather than read as
# "not found".
found() {
  local status=0
  grep "$@" >&2 || status=$?
  if [ "$status" -gt 1 ]; then
    echo "ERROR: check-no-proprietary could not scan (grep exit $status): grep $*" >&2
    exit 2
  fi
  [ "$status" -eq 0 ]
}

# 1. The package directory.
if [ -e "packages/$name" ]; then
  report "packages/$name exists. The proprietary package must stay deleted."
fi

# 2. Manifests, by name: every package.json outside node_modules (the root, apps/*,
#    packages/*, packages/cli/templates/*, fixtures/*), and .gitmodules.
if found -rIn --include=package.json --exclude-dir=node_modules \
  --exclude-dir=.git -e "$name" .; then
  report "a package.json above names the proprietary package."
fi
if [ -f .gitmodules ] && found -n -e "$name" .gitmodules; then
  report ".gitmodules above points at the proprietary package."
fi

# 3. Module specifiers in apps/ and packages/ source: the package name, or a
#    subpath of it, as a whole quoted string, or as a template literal passed to
#    import() or require(). A component id ("...:AnimateChildren") is not one.
#    package.json files are covered by name in step 2.
specifier="@webstudio-is/$name"
quoted="[\"']${specifier}(/[^\"'[:space:]]*)?[\"']"
template="(import|require)[[:space:]]*\([[:space:]]*\`${specifier}(/[^\`[:space:]]*)?\`"
if found -rInE \
  --include="*.ts" --include="*.tsx" --include="*.mts" --include="*.cts" \
  --include="*.js" --include="*.jsx" --include="*.mjs" --include="*.cjs" \
  --include="*.json" --exclude=package.json --exclude-dir=node_modules \
  -e "${quoted}|${template}" apps packages; then
  report "source above imports or names the proprietary package as a module."
fi

# 4. The lockfile.
if found -n -e "$name" pnpm-lock.yaml; then
  report "pnpm-lock.yaml above has an entry for the proprietary package."
fi

# 5. The proprietary EULA license banner must not appear anywhere we ship. The
#    banner SPDX id is assembled here so this guard does not flag its own source;
#    docs/ (which describe the policy in prose) and this script are excluded.
banner="LicenseRef-Webstudio,""Inc-Proprietary"
if found -rIn --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=docs --exclude="check-no-proprietary.sh" -e "$banner" .; then
  report "the proprietary EULA license banner above must not ship."
fi

if [ "$fail" -ne 0 ]; then
  echo "       This is an AGPL-only fork; @webstudio-is/$name must stay removed." >&2
  exit 1
fi

echo "OK: no proprietary animation package in the tree, manifests, module specifiers or lockfile."
