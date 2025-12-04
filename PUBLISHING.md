# Publishing Guide

This guide explains how to publish the @railrepay/* packages to npm.

## Prerequisites

1. An npm account (create at https://www.npmjs.com if you don't have one)
2. Access to the @railrepay scope on npm (or use @loloatlo scope as fallback)
3. Node.js 20.x installed locally

## Option 1: Publish Under @railrepay Scope (Recommended)

### Setup npm Scope

If @railrepay scope doesn't exist:

1. Create an npm organization:
   - Go to https://www.npmjs.com
   - Click your profile > "Add Organization"
   - Create organization named "railrepay"
   - Add team members as needed

2. All packages are already configured with `"name": "@railrepay/package-name"`

### Initial Manual Publish

From the repository root:

```bash
# Authenticate with npm
npm login

# Build all packages
npm run build

# Publish all packages
npm publish --workspaces --access public
```

This will publish:
- @railrepay/kafka-client@1.0.0
- @railrepay/postgres-client@1.0.0
- @railrepay/redis-cache@1.0.0
- @railrepay/winston-logger@1.0.0
- @railrepay/metrics-pusher@1.0.0
- @railrepay/openapi-validator@1.0.0

## Option 2: Publish Under Your User Scope (Fallback)

If you cannot create/access @railrepay organization, publish under your username:

### Update Package Names

Replace @railrepay with @loloatlo in all package.json files:

```bash
# From repository root
for pkg in packages/*/package.json; do
  sed -i 's/@railrepay/@loloatlo/g' "$pkg"
done
```

### Publish

```bash
npm login
npm run build
npm publish --workspaces --access public
```

This will publish:
- @loloatlo/kafka-client@1.0.0
- @loloatlo/postgres-client@1.0.0
- etc.

## Automated Publishing via GitHub Actions

### Setup

1. Generate npm automation token:
   ```
   https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   ```
   - Click "Generate New Token"
   - Select "Automation" type
   - Copy token

2. Add to GitHub Secrets:
   ```
   https://github.com/loloatlo/railrepay-shared-libs/settings/secrets/actions
   ```
   - Name: `NPM_TOKEN`
   - Value: Paste your token

### Trigger Automated Publish

Create and push a git tag:

```bash
# Create version tag
git tag v1.0.0

# Push tag to trigger workflow
git push origin v1.0.0
```

Or manually trigger via GitHub UI:
```
https://github.com/loloatlo/railrepay-shared-libs/actions/workflows/publish.yml
```

## Version Updates

To publish a new version:

1. Update version in package.json files:
   ```bash
   # Update all packages to 1.0.1
   npm version patch --workspaces
   ```

2. Commit changes:
   ```bash
   git add .
   git commit -m "Bump version to 1.0.1"
   git push
   ```

3. Create and push tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

## Troubleshooting

### "You do not have permission to publish @railrepay/package-name"

- The @railrepay scope doesn't exist or you don't have access
- Solution: Create organization or use @loloatlo scope

### "Cannot publish over existing version 1.0.0"

- Version already exists on npm
- Solution: Bump version numbers

### "ENEEDAUTH" error

- Not logged into npm
- Solution: Run `npm login`

### GitHub Actions fails with 403

- NPM_TOKEN not set or invalid
- Solution: Regenerate token and update GitHub secret

## Testing Installation After Publishing

Verify packages are available:

```bash
npm view @railrepay/kafka-client
npm view @railrepay/winston-logger
# etc.
```

Test installation in a new project:

```bash
mkdir test-install
cd test-install
npm init -y
npm install @railrepay/kafka-client
```

## Next Steps for whatsapp-handler

Once packages are published, update whatsapp-handler:

1. Update package.json to use published versions:
   ```json
   {
     "dependencies": {
       "@railrepay/kafka-client": "^1.0.0",
       "@railrepay/winston-logger": "^1.0.0",
       "@railrepay/redis-cache": "^1.0.0",
       "@railrepay/openapi-validator": "^1.0.0"
     }
   }
   ```

2. Remove local file: references

3. Run npm install to fetch from registry

4. Verify GitHub Actions CI can install dependencies
