#!/bin/bash
# Build locally and upload as a GitHub Release
# Prerequisites: brew install gh  (GitHub CLI)
# One-time auth: gh auth login

set -e

# Run the existing build
echo "=== Running full build ==="
./packaging_scripts/full_run_dmg.sh

# Get the version that was just built
VERSION=$(node -p "require('./package.json').version")
DMG_PATH="release_builds/Studio Guide-${VERSION}.dmg"

if [ ! -f "$DMG_PATH" ]; then
    echo "Error: DMG not found at $DMG_PATH"
    exit 1
fi

echo ""
echo "DMG size: $(du -sh "$DMG_PATH" | cut -f1)"
echo ""

# Create a git tag and push it
TAG="v${VERSION}"
echo "=== Creating tag $TAG ==="
git add package.json
git commit -m "Release ${TAG}" || echo "No changes to commit"
git tag -a "$TAG" -m "Release ${TAG}"
git push origin master --tags

# Create GitHub Release with the DMG attached
echo "=== Creating GitHub Release ==="
gh release create "$TAG" \
    "$DMG_PATH" \
    --title "Studio Guide ${VERSION}" \
    --notes "Studio Guide v${VERSION} for macOS (Apple Silicon arm64)

## Installation
1. Download **Studio Guide-${VERSION}.dmg** below
2. Open the DMG and drag Studio Guide to Applications
3. On first launch: right-click → Open (bypasses Gatekeeper for ad-hoc signed apps)" \
    --latest

echo ""
echo "=== Done ==="
echo "Release URL: $(gh release view "$TAG" --json url -q .url)"
