#!/bin/bash

# Configuration
APP_NAME="Studio Guide"
BACKEND_DIR="backend"
DIST_DIR="release_builds"
BUILD_DIR="out"

# Ensure we are in the script's directory
cd "$(dirname "$0")/.."

# Copy new icon
echo "Copying icon..."
cp "icon/icon_1024x1024_1024x1024.icns" "icon.icns"

echo "Using Node: $(node -v)"
echo "Using NPM: $(npm -v)"

# --- 1. Version Management ---
echo "--- 1. Incrementing Version ---"
node -e "
const fs = require('fs');
const pkg = require('./package.json');
const parts = pkg.version.split('.');
parts[2] = parseInt(parts[2], 10) + 1;
pkg.version = parts.join('.');
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('New Version:', pkg.version);
"

NEW_VERSION=$(node -p "require('./package.json').version")
echo "Building Version: $NEW_VERSION"


# --- 2. Environment Setup ---


# --- 4. Package Electron App ---
echo "--- 4. Packaging Electron App ---"
rm -rf "$BUILD_DIR"

# --- 4a. Build Frontend ---
echo "--- 4a. Building Frontend ---"
cd "frontend"
npm install
npm run build
cd ..

if [ ! -d "frontend/dist" ]; then
    echo "Error: Frontend build failed. 'frontend/dist' not found."
    exit 1
fi

npm install

echo "Rebuilding native modules for Electron..."
./node_modules/.bin/electron-rebuild

npx electron-packager . "$APP_NAME" \
    --platform=darwin \
    --arch=arm64 \
    --out="$BUILD_DIR" \
    --overwrite \
    --ignore="^/backend/(?!dist)" \
    --ignore="^/backend/build" \
    --ignore="^/backend/venv" \
    --ignore="^/out" \
    --ignore="^/frontend" \
    --ignore="^/release_builds" \
    --ignore="^/dist/.*\.dmg$" \
    --ignore="^/dist/.*\.zip$" \
    --ignore="^/\.git" \
    --ignore="^/\.ds_store" \
    --icon="icon.icns"

APP_PATH="$BUILD_DIR/$APP_NAME-darwin-arm64/$APP_NAME.app"

if [ ! -d "$APP_PATH" ]; then
    echo "Error: Electron packager failed."
    exit 1
fi

echo "Electron app packaged at: $APP_PATH"



# --- 5a. Inject Frontend Dist ---
echo "--- 5a. Injecting Frontend Dist ---"
DEST_FRONTEND_DIR="$APP_PATH/Contents/Resources/frontend"
mkdir -p "$DEST_FRONTEND_DIR"

cp -R "frontend/dist" "$DEST_FRONTEND_DIR/dist"
echo "Frontend dist injected."

# --- 6. Ad-hoc Signing ---
echo "--- 6. Ad-hoc Signing ---"
codesign -s - --force --deep "$APP_PATH"

# --- 7. Size Report ---
echo ""
echo "--- Build Complete ---"
echo "App located at: $APP_PATH"
echo "App size: $(du -sh "$APP_PATH" | cut -f1)"
echo ""