Release & Versioning Policy

Branching model
- main: production-ready releases. Tags reflect released versions (semver).
- develop: integration branch for ongoing work; merged to `main` for releases.
- feature/*: feature branches created from `develop`.
- fix/* or hotfix/*: bugfix branches from `main` or `develop` as appropriate.

Versioning
- We use Semantic Versioning: MAJOR.MINOR.PATCH
  - MAJOR for incompatible API changes
  - MINOR for new features in a backwards-compatible manner
  - PATCH for bug fixes and small changes

Commit messages
- Follow Conventional Commits to enable reliable changelogs and automation.
  - Examples:
    - feat(report): add throughput metric
    - fix(export): handle large CSV gracefully
    - chore(deps): bump pdf-lib

Release process
- Manual lightweight flow (recommended):
  - Ensure `develop` has the desired changes and tests pass.
  - Merge `develop` into `main` using PR and release notes.
  - Create an annotated tag, e.g. `git tag -a v1.2.0 -m "Release v1.2.0"` and push the tag: `git push origin v1.2.0`.

- Optional automated flow (CI): Use `semantic-release` or GitHub Actions to create releases from Conventional Commits.

Example commands
```powershell
# bump patch and tag using npm version (if package.json used for release)
npm version patch -m "chore(release): %s"
# push tags
git push --follow-tags origin main
# or create annotated tag manually
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Notes
- Keep releases focused and include changelog notes for users.
- Use `RELEASE.md` and `CHANGELOG.md` to document release notes and decisions.
