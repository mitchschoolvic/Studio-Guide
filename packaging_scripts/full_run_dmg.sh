#!/bin/bash
set -e  # Exit immediately on any error so a failed step can't waste a version bump

# Configuration
APP_NAME="Studio Guide"
BACKEND_DIR="backend"
BUILD_DIR="out"

# Resolve the skeleton-app root as an absolute path so all relative paths are
# correct regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Output directory is always relative to the skeleton-app root
DIST_DIR="$ROOT_DIR/release_builds"

cd "$ROOT_DIR"
echo "Working directory: $(pwd)"

# Copy new icon
echo "Copying icon..."
cp "icon/icon_1024x1024_1024x1024.icns" "icon.icns"

echo "Using Node: $(node -v)"
echo "Using NPM: $(npm -v)"

# --- 1. Version Management ---
echo "--- 1. Incrementing Version ---"

# Increment patch version and write back to package.json.
# We use a temp file + mv to make the write atomic.
node -e "
const fs = require('fs');
const pkgPath = require('path').resolve('./package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const parts = pkg.version.split('.');
parts[2] = parseInt(parts[2], 10) + 1;
pkg.version = parts.join('.');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('New Version:', pkg.version);
"

# Read version from disk (fresh parse, no module cache)
NEW_VERSION=$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('./package.json','utf8')); process.stdout.write(p.version);")
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
cd "$ROOT_DIR"

if [ ! -d "frontend/dist" ]; then
    echo "Error: Frontend build failed. 'frontend/dist' not found."
    exit 1
fi

# --- 4b. Compile Electron TypeScript (main + preload) ---
echo "--- 4b. Compiling Electron TypeScript ---"
npx tsc
echo "TypeScript compiled to dist/"

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
    echo "Error: Electron packager failed. App not found at: $APP_PATH"
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

# --- 8. Create DMG ---
echo "--- 8. Creating DMG ---"
mkdir -p "$DIST_DIR"
DMG_NAME="$APP_NAME-$NEW_VERSION.dmg"
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

echo "--- Full Run & DMG Creation Complete ---"
echo "Output: $DMG_PATH"
