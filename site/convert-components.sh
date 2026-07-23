#!/bin/bash
set -e

# Task 9: Convert Mintlify components to Vocs
# - CardGroup -> Cards
# - Card href -> to
# - Add imports
# - Unwrap Frame

cd "$(dirname "$0")"

files=$(grep -rlE "<(Card|CardGroup|Tabs|Tab|Frame)[ />]" src/pages)

for file in $files; do
  echo "Processing: $file"

  # Step 1: Replace CardGroup with Cards (opening and closing tags, drop cols)
  perl -i -pe 's/<CardGroup\b[^>]*>/<Cards>/g' "$file"
  perl -i -pe 's/<\/CardGroup>/<\/Cards>/g' "$file"

  # Step 2: Replace Card href with to
  perl -i -pe 's/(<Card\b[^>]*)\bhref=/\1to=/g' "$file"

  # Step 3: Unwrap Frame tags
  perl -i -0777 -pe 's/<Frame>\s*//g' "$file"
  perl -i -0777 -pe 's/\s*<\/Frame>//g' "$file"

  # Step 4: Add imports at the top (after frontmatter)
  # Detect which components are used
  needs_card=$(grep -E "<Card\b" "$file" | wc -l || echo 0)
  needs_cards=$(grep -E "<Cards>" "$file" | wc -l || echo 0)
  needs_tabs=$(grep -E "<Tabs>" "$file" | wc -l || echo 0)
  needs_tab=$(grep -E "<Tab\b" "$file" | wc -l || echo 0)

  # Build import list
  imports=()
  if [ "$needs_card" -gt 0 ]; then imports+=("Card"); fi
  if [ "$needs_cards" -gt 0 ]; then imports+=("Cards"); fi
  if [ "$needs_tabs" -gt 0 ]; then imports+=("Tabs"); fi
  if [ "$needs_tab" -gt 0 ]; then imports+=("Tab"); fi

  if [ ${#imports[@]} -gt 0 ]; then
    # Join with commas
    import_str=$(IFS=,; echo "${imports[*]}")
    import_line="import { $import_str } from 'vocs'\n"

    # Check if import already exists
    if ! grep -q "^import.*from 'vocs'" "$file"; then
      # Insert after frontmatter (after ---)
      if grep -q "^---$" "$file"; then
        # Find line after second ---
        awk -v imp="$import_line" '
          BEGIN { count = 0; printed = 0 }
          /^---$/ { count++; print; if (count == 2) { printf "%s\n", imp; printed = 1 }; next }
          { print }
        ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
      else
        # No frontmatter, add at top
        echo -e "$import_line$(cat "$file")" > "$file"
      fi
    fi
  fi
done

echo "✓ Component conversion complete"
