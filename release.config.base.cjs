module.exports = {
  branches: [
    "main",
    { name: "beta", channel: "beta", prerelease: true },
    { name: "next-major", channel: "next-major", prerelease: true }
  ]
};
