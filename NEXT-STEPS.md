# Next Steps: Publishing @railrepay Libraries to npm

The repository structure is complete and pushed to GitHub. Follow these steps to publish the packages to npm.

## Quick Start (Recommended Path)

### 1. Create @railrepay npm Organization

Since you'll be publishing scoped packages (@railrepay/*), you need to create the organization first:

1. Go to https://www.npmjs.com
2. Login or create an account (if you don't have one)
3. Click your profile icon → "Add Organization"
4. Create organization named "railrepay"
5. Make it public (free for open source)

### 2. Publish Packages Manually (First Time)

From your terminal in the repository directory:

```bash
cd /mnt/c/Users/nicbo/Documents/railrepay-shared-libs

# Login to npm
npm login
# Enter your npm credentials

# Install dependencies
npm install

# Build all packages
npm run build

# Publish all 6 packages at once
npm publish --workspaces --access public
```

This will publish:
- @railrepay/kafka-client@1.0.0
- @railrepay/postgres-client@1.0.0
- @railrepay/redis-cache@1.0.0
- @railrepay/winston-logger@1.0.0
- @railrepay/metrics-pusher@1.0.0
- @railrepay/openapi-validator@1.0.0

### 3. Setup Automated Publishing (GitHub Actions)

For future releases, set up automated publishing:

1. Generate npm automation token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token" → "Automation"
   - Copy the token (starts with npm_...)

2. Add token to GitHub:
   - Go to https://github.com/loloatlo/railrepay-shared-libs/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm automation token
   - Click "Add secret"

3. Test automated publishing:
   ```bash
   cd /mnt/c/Users/nicbo/Documents/railrepay-shared-libs
   git tag v1.0.0
   git push origin v1.0.0
   ```

The GitHub Actions workflow will automatically build and publish all packages.

## Alternative: Publish Under Your User Scope

If you don't want to create an organization, you can publish under your username (@loloatlo/*):

1. Update all package names:
   ```bash
   cd /mnt/c/Users/nicbo/Documents/railrepay-shared-libs

   # Replace @railrepay with @loloatlo in all package.json files
   for pkg in packages/*/package.json; do
     sed -i 's/@railrepay/@loloatlo/g' "$pkg"
   done
   ```

2. Commit the changes:
   ```bash
   git add .
   git commit -m "Update scope from @railrepay to @loloatlo"
   git push
   ```

3. Publish:
   ```bash
   npm login
   npm run build
   npm publish --workspaces --access public
   ```

## Verify Publishing

After publishing, verify packages are available:

```bash
npm view @railrepay/kafka-client
npm view @railrepay/winston-logger
npm view @railrepay/postgres-client
npm view @railrepay/redis-cache
npm view @railrepay/metrics-pusher
npm view @railrepay/openapi-validator
```

Or test installation in a new directory:

```bash
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install @railrepay/kafka-client
```

## Update whatsapp-handler

Once packages are published, update the whatsapp-handler service:

1. Update `/mnt/c/Users/nicbo/Documents/RailRepay MVP/timetable-loader/package.json`:
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

2. Remove the old "file:" references

3. Run:
   ```bash
   cd /mnt/c/Users/nicbo/Documents/RailRepay\ MVP/timetable-loader
   npm install
   ```

4. Test that GitHub Actions CI can now install dependencies

## Repository Details

- **GitHub**: https://github.com/loloatlo/railrepay-shared-libs
- **Structure**: Monorepo with npm workspaces
- **CI/CD**: GitHub Actions workflow in `.github/workflows/publish.yml`
- **Documentation**: See `README.md` and `PUBLISHING.md` in the repository

## Troubleshooting

### "You do not have permission to publish @railrepay/package-name"
- Solution: Either create @railrepay organization OR use @loloatlo scope

### "npm ERR! need auth"
- Solution: Run `npm login` first

### "Cannot publish over existing version"
- Solution: Bump version numbers before republishing

### GitHub Actions fails with 403
- Solution: Check that NPM_TOKEN secret is set correctly

## Support

For detailed publishing instructions, see:
- `PUBLISHING.md` in the repository
- Individual package READMEs in `packages/*/README.md`
