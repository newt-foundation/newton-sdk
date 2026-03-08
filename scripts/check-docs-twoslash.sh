#!/usr/bin/env bash
# Verify TypeScript code samples in docs using twoslash-cli.
# twoslash-cli only supports .md files, so we symlink .mdx -> .md in a temp dir.

set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/../site" && pwd)"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

# Find all .mdx files and create .md symlinks preserving directory structure
find "$SITE_DIR" -name '*.mdx' | while read -r mdx_file; do
  rel_path="${mdx_file#"$SITE_DIR"/}"
  md_path="$TMP_DIR/${rel_path%.mdx}.md"
  mkdir -p "$(dirname "$md_path")"
  ln -s "$mdx_file" "$md_path"
done

# Count files with twoslash code blocks
twoslash_files=$(grep -rl 'twoslash' "$TMP_DIR" 2>/dev/null || true)
twoslash_count=$(echo "$twoslash_files" | grep -c . || true)

if [ "$twoslash_count" -eq 0 ]; then
  echo "No twoslash code blocks found in docs. Skipping verification."
  exit 0
fi

echo "Found $twoslash_count file(s) with twoslash code blocks. Verifying..."

# Run twoslash-cli against the temp directory
npx twoslash-cli "$TMP_DIR"/**/*.md "$TMP_DIR/out" 2>&1

echo "Twoslash verification passed."
