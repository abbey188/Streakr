#!/usr/bin/env bash
# Push every var from .env.local into Vercel for a given environment.
# Run AFTER `vercel login` and `vercel link`.
#
#   bash scripts/push-vercel-env.sh              # -> production
#   bash scripts/push-vercel-env.sh .env.local preview
#
# Re-running is safe: it removes an existing var before re-adding it.
set -uo pipefail

ENV_FILE="${1:-.env.local}"
TARGET="${2:-production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE found." >&2
  exit 1
fi

echo "Pushing $ENV_FILE → Vercel ($TARGET)…"
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*) continue ;;            # skip blanks and comments
  esac
  key="${line%%=*}"
  val="${line#*=}"
  key="$(echo "$key" | tr -d '[:space:]')"
  # strip one layer of surrounding double quotes, if present
  val="${val%\"}"; val="${val#\"}"
  [ -z "$key" ] && continue
  echo "  → $key"
  vercel env rm "$key" "$TARGET" -y >/dev/null 2>&1 || true
  printf '%s' "$val" | vercel env add "$key" "$TARGET" >/dev/null 2>&1 \
    && echo "     ok" || echo "     FAILED (add manually)"
done < "$ENV_FILE"

echo "Done. Verify with:  vercel env ls"
