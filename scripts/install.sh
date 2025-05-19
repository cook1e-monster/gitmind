#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_JS="$PROJECT_ROOT/apps/cli/dist/main.js"
WRAPPER="$HOME/.local/bin/gitmind"

# Create the bin directory if it doesn't exist
mkdir -p "$HOME/.local/bin"

# Create the wrapper bash script
echo '#!/bin/bash' > ~/.local/bin/gitmind
echo 'exec bun /home/carlos/Desktop/Projects/gitmind/apps/cli/dist/main.js "$@"' >> ~/.local/bin/gitmind
chmod +x ~/.local/bin/gitmind

# Detect shell and config file
if [ -n "$ZSH_VERSION" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
  SHELL_RC="$HOME/.bashrc"
else
  # Default to bash if unknown
  SHELL_RC="$HOME/.bashrc"
fi

# Add to PATH if not already present
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_RC"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
  echo "✅ Added $HOME/.local/bin to PATH in $SHELL_RC"
else
  echo "ℹ️ $HOME/.local/bin is already in your PATH in $SHELL_RC"
fi

echo "✅ GitMind CLI installed successfully!"
echo "You can now use the 'gitmind' command from anywhere."
echo "Restart your terminal or run: source $SHELL_RC" 