#!/bin/bash
# Clean all git history and start fresh with mitchschoolvic identity

set -e

echo "=== Cleaning Git History ==="
echo ""
echo "This will:"
echo "  1. Delete all existing releases"
echo "  2. Wipe all commit history"
echo "  3. Set git user to mitchschoolvic"
echo "  4. Create fresh initial commit"
echo "  5. Force push to origin"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Delete all existing releases
echo ""
echo "=== Deleting existing releases ==="
gh release list --json tagName -q '.[].tagName' | while read -r tag; do
    echo "Deleting release $tag..."
    gh release delete "$tag" --yes --cleanup-tag
done

# Delete all local tags
echo ""
echo "=== Deleting local tags ==="
git tag -l | xargs -r git tag -d

# Remove .git directory and reinitialize
echo ""
echo "=== Reinitializing repository ==="
rm -rf .git
git init
git branch -M master

# Configure git user for this repo
echo ""
echo "=== Configuring git identity ==="
echo "Enter your mitchschoolvic email:"
read -p "Email: " email
git config user.name "mitchschoolvic"
git config user.email "$email"

echo ""
echo "Configured as:"
echo "  Name: $(git config user.name)"
echo "  Email: $(git config user.email)"

# Create initial commit
echo ""
echo "=== Creating initial commit ==="
git add .
git commit -m "Initial commit"

# Add remote (update if needed)
echo ""
echo "=== Setting remote ==="
git remote add origin https://github.com/mitchschoolvic/Studio-Guide.git 2>/dev/null || \
    git remote set-url origin https://github.com/mitchschoolvic/Studio-Guide.git

# Force push
echo ""
echo "=== Force pushing to origin ==="
git push -u origin master --force

echo ""
echo "=== Done ==="
echo "Repository history has been wiped clean."
echo "All commits are now under mitchschoolvic."
