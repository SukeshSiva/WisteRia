#!/bin/bash

# This script helps you publish the WisteRia v0.1.0-beta.1 release to GitHub.

VERSION="v0.1.0-beta.1"
DMG_PATH="src-tauri/target/release/bundle/dmg/WisteRia_0.1.0-beta.1_aarch64.dmg"
RELEASE_NOTES="RELEASE_NOTES.md"

echo "Checking for GitHub CLI (gh)..."
if ! command -v gh &> /dev/null
then
    echo "GitHub CLI (gh) not found. You can install it with: brew install gh"
    echo "After installing, run 'gh auth login' to authenticate."
    exit 1
fi

echo "Creating GitHub Release $VERSION and uploading $DMG_PATH..."
gh release create "$VERSION" "$DMG_PATH" \
    --title "WisteRia $VERSION" \
    --notes-file "$RELEASE_NOTES" \
    --prerelease

if [ $? -eq 0 ]; then
    echo "Release successfully created!"
else
    echo "Failed to create release. Please check your permissions or network connection."
fi
