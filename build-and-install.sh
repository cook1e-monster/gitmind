#!/bin/bash

set -e

EXT_DIR="apps/vscode-extension"
VSIX_NAME="gitmind-assistant-0.0.1.vsix"
FULL_ID="cook1e-monster.gitmind-assistant"

echo "🧹 Cleaning old installations..."
code --uninstall-extension "$FULL_ID" || true
code --uninstall-extension undefined_publisher.gitmind-assistant || true

echo "📦 1. Compiling TypeScript..."
cd "$EXT_DIR"
echo "Current directory: $(pwd)"
rm -rf dist
echo "Installing dependencies..."
npm install
echo "Compiling TypeScript..."
npm run compile
echo "Checking dist directory..."
ls -la dist/

echo "📦 2. Packaging VSCode extension..."
# Clean any existing vsix
rm -f *.vsix
# Package the extension
npx vsce package --allow-missing-repository --no-dependencies

echo "🧩 3. Installing extension locally..."
code --install-extension "$VSIX_NAME"

echo "🧪 4. Opening extension development environment..."
cd ../..
code . --extensionDevelopmentPath="$EXT_DIR"

echo "✅ All ready. In VSCode use:"
echo "👉 Ctrl+Shift+P > GitMind: Generate Commit with AI"
