#!/bin/bash
# Verification script for railrepay-shared-libs publishing setup

set -e

echo "========================================="
echo "RailRepay Shared Libraries - Setup Verification"
echo "========================================="
echo ""

# Check repository
echo "1. Checking repository..."
if [ -d ".git" ]; then
    REMOTE=$(git remote get-url origin 2>/dev/null || echo "No remote")
    echo "   ✓ Git repository initialized"
    echo "   ✓ Remote: $REMOTE"
else
    echo "   ✗ Not a git repository"
    exit 1
fi
echo ""

# Check package structure
echo "2. Checking package structure..."
EXPECTED_PACKAGES=("kafka-client" "postgres-client" "redis-cache" "winston-logger" "metrics-pusher" "openapi-validator")
FOUND=0
for pkg in "${EXPECTED_PACKAGES[@]}"; do
    if [ -f "packages/$pkg/package.json" ]; then
        echo "   ✓ $pkg"
        FOUND=$((FOUND + 1))
    else
        echo "   ✗ $pkg NOT FOUND"
    fi
done
echo "   Found $FOUND/6 packages"
echo ""

# Check publishConfig in all packages
echo "3. Checking publishConfig..."
for pkg in "${EXPECTED_PACKAGES[@]}"; do
    if grep -q '"publishConfig"' "packages/$pkg/package.json" 2>/dev/null; then
        echo "   ✓ $pkg has publishConfig"
    else
        echo "   ✗ $pkg missing publishConfig"
    fi
done
echo ""

# Check for private flag
echo "4. Checking for 'private' flag (should be NONE)..."
PRIVATE_COUNT=$(grep -r '"private": true' packages/*/package.json 2>/dev/null | grep -v node_modules | wc -l)
if [ "$PRIVATE_COUNT" -eq 0 ]; then
    echo "   ✓ No 'private' flags found in package.json files"
else
    echo "   ✗ Found $PRIVATE_COUNT 'private' flags:"
    grep -r '"private": true' packages/*/package.json | grep -v node_modules
fi
echo ""

# Check GitHub Actions workflow
echo "5. Checking GitHub Actions workflow..."
if [ -f ".github/workflows/publish.yml" ]; then
    echo "   ✓ Publish workflow exists"
else
    echo "   ✗ Publish workflow NOT FOUND"
fi
echo ""

# Check documentation
echo "6. Checking documentation..."
DOCS=("README.md" "PUBLISHING.md" "NEXT-STEPS.md" "LICENSE")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "   ✓ $doc"
    else
        echo "   ✗ $doc NOT FOUND"
    fi
done
echo ""

echo "========================================="
echo "Verification complete!"
echo ""
echo "Next steps:"
echo "1. Create @railrepay organization on npm (https://www.npmjs.com)"
echo "2. Run 'npm login' to authenticate"
echo "3. Run 'npm run build' to build all packages"
echo "4. Run 'npm publish --workspaces --access public' to publish"
echo ""
echo "See NEXT-STEPS.md for detailed instructions."
echo "========================================="
