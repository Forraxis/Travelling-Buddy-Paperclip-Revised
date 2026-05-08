# Branch Protection Rules

Configure these rules in GitHub → Settings → Branches for `main` and `develop`.

## `main` branch

| Setting | Value |
|---------|-------|
| Require pull request before merging | Yes |
| Required approvals | 1 |
| Require status checks to pass | Yes |
| Required checks | `ci` |
| Require branches to be up to date | Yes |
| No force pushes | Yes |
| No deletions | Yes |

## `develop` branch

| Setting | Value |
|---------|-------|
| Require pull request before merging | Yes |
| Required approvals | 1 |
| Require status checks to pass | Yes |
| Required checks | `ci` |
| No force pushes | Yes |
| No deletions | Yes |
