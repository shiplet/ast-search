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

Create `packages/<name>/.releaserc.json` if it doesn't exist. Include the `pnpm install --no-frozen-lockfile` exec step and the lockfile in git assets — both are required to keep the lockfile in sync after multi-semantic-release rewrites `workspace:^` references to real version numbers:

```json
{
  "branches": ["main"],
  "tagFormat": "<name>@${version}",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    ["@semantic-release/npm", { "npmPublish": true }],
    ["@semantic-release/exec", { "prepareCmd": "pnpm install --no-frozen-lockfile" }],
    ["@semantic-release/git", { "assets": ["package.json", "CHANGELOG.md", "../../pnpm-lock.yaml"], "message": "chore(release): <name> ${nextRelease.version} [skip ci]" }],
    "@semantic-release/github"
  ]
}
```

**Why the exec step is needed:** multi-semantic-release rewrites `workspace:^` dependencies to real version numbers (e.g. `^1.8.0`) in `package.json` before the git commit. The repo's pre-commit hook validates the lockfile with `pnpm install --frozen-lockfile`, so if the lockfile still says `workspace:^` the commit will fail. The exec step updates the lockfile to match, and the git plugin commits it.

**Important:** The `pnpm install` step runs during `prepare`, which is *before* `@semantic-release/npm` publishes the package. This means any bumped workspace dependency versions won't exist on npm yet when the install runs. The repo's `.npmrc` sets `link-workspace-packages=true` so pnpm resolves those packages from the local workspace instead of the registry, avoiding `ERR_PNPM_NO_MATCHING_VERSION`.

**Note on `.npmrc` warnings:** npm also reads `.npmrc` and will emit `Unknown config "link-workspace-packages"` warnings during the publish steps. These are harmless — npm ignores the key, pnpm uses it correctly. Do not attempt to move this setting elsewhere:
- `linkWorkspacePackages` in the `"pnpm"` section of `package.json` is not read by pnpm for this purpose
- `--config.link-workspace-packages=true` as a CLI flag is accepted by pnpm but does not activate the behavior at resolve time

### Step 3 — release.yml build step

Read `.github/workflows/release.yml` and add `pnpm --filter <name> run build` to the Build step's `run` command alongside the other packages.

### Step 4 — Check for ghost tags on workspace dependencies

Before triggering a release, check whether any workspace dependencies have a git tag that was never published to npm. This happens when a previous release run tagged git but failed before the npm publish step.

For each `workspace:^` dependency in the new package's `package.json`:
1. Check the current git tag version: `git tag | grep <dep>@`
2. Check what's on npm: `npm view <dep> version`
3. If the git tag version is higher than npm, manually publish: `cd packages/<dep> && npm publish --no-provenance`

If a ghost tag exists and isn't fixed, `pnpm install --no-frozen-lockfile` will fail with `ERR_PNPM_NO_MATCHING_VERSION` because multi-semantic-release resolves `workspace:^` to the tagged (but unpublished) version.

### Step 5 — npm Trusted Publishing (manual)

Tell the user to:
1. Do a one-time local publish to create the package on npm: `cd packages/<name> && npm publish --access public --no-provenance`
   - If you get `EUSAGE: Automatic provenance generation not supported for provider: null`, that's expected — use `--no-provenance` as shown
   - If you get `E404 Not Found`, run `npm whoami` to confirm you're logged in
2. Go to npmjs.com → the package → Settings → Trusted Publishers and add:
   - Owner: `willey-shiplet`
   - Repository: `ast-search`
   - Workflow filename: `release.yml`
   - Environment: (leave blank)

Wait for the user to confirm both are done before proceeding.

### Step 6 — Trigger release

Tell the user to merge their branch to `main` and watch the GitHub Actions Release workflow. The new package should appear in the `package paths` list, find no previous git tag, and release as `1.0.0`. Other packages with no new commits will be skipped.

If the release fails, check the logs for:
- `ERR_PNPM_NO_MATCHING_VERSION` — ghost tag issue, see Step 4
- `ERR_PNPM_OUTDATED_LOCKFILE` — lockfile sync issue; verify the exec step and lockfile asset are in `.releaserc.json`

### Step 7 — Confirm success

Wait for the user to report back that the release workflow succeeded. Once confirmed, the skill is complete. Congratulate the user and summarize what was set up.
