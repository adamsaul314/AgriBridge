#!/usr/bin/env bash
#
# Publish AgriBridge media to the public Google Cloud Storage bucket.
#
# Only media that is NOT committed to git lives here: gallery thumbnails and the
# hero video. Small brand chrome (favicon, logos, hero poster) is served from the
# repo itself, so it is not uploaded. See .gitignore and DECISIONS.md GAL-02.
#
# Usage:
#   ./scripts/upload-media.sh            # upload
#   ./scripts/upload-media.sh --dry-run  # show what would be uploaded
#
# Requires the Google Cloud SDK and an authenticated account with write access
# to the bucket: gcloud auth login

set -euo pipefail

BUCKET="gs://agribridge"
CACHE="Cache-Control:public, max-age=2592000" # 30 days; media files are immutable
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v gsutil >/dev/null 2>&1; then
  echo "gsutil not found. Install the Google Cloud SDK and run 'gcloud auth login'." >&2
  exit 1
fi

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] gsutil $*"
  else
    gsutil "$@"
  fi
}

echo "==> thumbnails -> $BUCKET/thumbs/"
if compgen -G "assets/gallery/thumbs/*.webp" > /dev/null; then
  run -m -h "$CACHE" -h "Content-Type:image/webp" cp assets/gallery/thumbs/*.webp "$BUCKET/thumbs/"
else
  echo "skip: no thumbnails found" >&2
fi

if [[ -f "assets/videos/hero.mp4" ]]; then
  echo "==> assets/videos/hero.mp4 -> $BUCKET/hero.mp4"
  run -h "$CACHE" -h "Content-Type:video/mp4" cp assets/videos/hero.mp4 "$BUCKET/hero.mp4"
else
  echo "skip: assets/videos/hero.mp4 not found" >&2
fi

echo "Done."
