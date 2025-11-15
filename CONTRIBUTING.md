## Contribution Guidelines

Please follow these guidelines when contributing to the repository. These steps help maintain quality and prevent accidental breaking changes.

1. Branches & PRs
   - Create feature branches from `main`.
   - Always open a pull request and assign the `@somritdasgupta` as a reviewer if the change affects the application or dependencies.

2. Dependency updates
   - Dependency updates should be opened as draft PRs and reviewed manually before merging.
   - Automated dependency update workflows should produce draft PRs only (as configured) and not be merged without a full review.

3. CI & Tests
   - PRs must pass CI builds and checks (linting, build) before merging.
   - If a PR fails CI, update the code or revert the update and request another review.

4. Emergency Reverts
   - If a merge breaks the repo, create a `backup/<timestamp>` branch to preserve the bad history, and revert using `git revert` or open a PR to restore a known working commit.
