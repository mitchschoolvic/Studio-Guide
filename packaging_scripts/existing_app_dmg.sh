#!/bin/bash

# Configuration
APP_NAME="Studio Guide"
DIST_DIR="release_builds"
BUILD_DIR="out"

# Ensure we are in the script's directory
cd "$(dirname "$0")/.."

# Get current version from package.json without incrementing
VERSION=$(node -p "require('./package.json').version")
echo "Detected Version: $VERSION"

APP_PATH="$BUILD_DIR/$APP_NAME-darwin-arm64/$APP_NAME.app"

if [ ! -d "$APP_PATH" ]; then
    echo "Error: App not found at $APP_PATH."
    echo "Please run package_app.sh or full_run_dmg.sh first to build the app."
    exit 1
fi

echo "Found App at: $APP_PATH"

# --- Create DMG ---
echo "--- Creating DMG from existing app ---"
mkdir -p "$DIST_DIR"
DMG_NAME="$APP_NAME-$VERSION.dmg"
DMG_PATH="$DIST_DIR/$DMG_NAME"

echo "Creating DMG at $DMG_PATH..."

# Create a temporary folder to prepare the DMG content
DMG_SRC_DIR="$BUILD_DIR/dmg_source"
rm -rf "$DMG_SRC_DIR"
mkdir -p "$DMG_SRC_DIR"

# Copy App to staging
echo "Copying .app to staging..."
cp -R "$APP_PATH" "$DMG_SRC_DIR/"
# Create Symlink to Applications
ln -s /Applications "$DMG_SRC_DIR/Applications"

# Create DMG using hdiutil
echo "Running hdiutil..."
hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_SRC_DIR" -ov -format UDZO "$DMG_PATH"

if [ -f "$DMG_PATH" ]; then
    echo "DMG successfully created at: $DMG_PATH"
else
    echo "Error: DMG creation failed."
    exit 1
fi

# Cleanup
rm -rf "$DMG_SRC_DIR"

echo "--- DMG Creation Complete ---"
