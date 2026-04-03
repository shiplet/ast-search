const base = require('../../release.config.base.cjs');
module.exports = {
  ...base,
  tagFormat: "ast-search-python@${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    ["@semantic-release/npm", { "npmPublish": true }],
    ["@semantic-release/git", { "assets": ["package.json", "CHANGELOG.md"], "message": "chore(release): ast-search-python ${nextRelease.version} [skip ci]" }],
    "@semantic-release/github"
  ]
};
