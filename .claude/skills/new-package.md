# Add New Package to ast-search Monorepo

Walk through all steps to add a new package to the ast-search multi-semantic-release monorepo and confirm it releases successfully.

## Instructions

You are helping the user wire a new package into the ast-search monorepo release pipeline. Work through each step below in order, making the file changes directly and guiding the user through any manual steps they need to take. Do not move to the next step until the current one is complete.

Ask the user for the package name before starting if they haven't provided it.

### Step 1 — package.json fields

Read the package's `packages/<name>/package.json` and ensure it has:

- `"author": "shiplet"`
- `"license": "MIT"`
- `"repository"` with `type: "git"`, `url: "https://github.com/willey-shiplet/ast-search.git"`, and `directory: "packages/<name>"`
- `"files"` array: `["build/*.js", "build/*.d.ts", "README.md", "LICENSE"]`
- `"publishConfig"`: `{ "access": "public", "provenance": true }`
- `"prepublishOnly"` script that runs the build
- `@semantic-release/exec` in `devDependencies`

Add any missing fields.

### Step 2 — .releaserc.json

Create `packages/<name>/.releaserc.json` if it doesn't exist, modeled after `packages/ast-search-js/.releaserc.json`:

```json
{
  "branches": ["main"],
  "tagFormat": "<name>@${version}",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    ["@semantic-release/npm", { "npmPublish": true }],
    ["@semantic-release/git", { "assets": ["package.json", "CHANGELOG.md"], "message": "chore(release): <name> ${nextRelease.version} [skip ci]" }],
    "@semantic-release/github"
  ]
}
```

Do NOT include a `pnpm install --no-frozen-lockfile` exec step — this causes failures when workspace dependencies haven't been published yet.

### Step 3 — release.yml build step

Read `.github/workflows/release.yml` and add `pnpm --filter <name> run build` to the Build step's `run` command alongside the other packages.

### Step 4 — npm Trusted Publishing (manual)

Tell the user to:
1. Do a one-time local publish to create the package on npm: `cd packages/<name> && npm publish --access public --no-provenance`
2. Go to npmjs.com → the package → Settings → Trusted Publishers and add:
   - Owner: `willey-shiplet`
   - Repository: `ast-search`
   - Workflow filename: `release.yml`
   - Environment: (leave blank)

Wait for the user to confirm both are done before proceeding.

### Step 5 — Trigger release

Tell the user to merge their branch to `main` and watch the GitHub Actions Release workflow. Key things to watch for:
- The new package should appear in the `package paths` list
- It should find no previous git tag and retrieve all commits
- Watch for any `ERR_PNPM_NO_MATCHING_VERSION` errors — if seen, check whether a ghost git tag exists for a dependency (e.g. `ast-search-js@X.Y.Z` tagged but not published to npm) and manually publish it: `cd packages/<dep> && npm publish --no-provenance`

### Step 6 — Confirm success

Wait for the user to report back that the release workflow succeeded. Once confirmed, the skill is complete. Congratulate the user and summarize what was set up.
