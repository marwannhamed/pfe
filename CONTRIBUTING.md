# Contributing

## Branching

- Create feature branches from `main`.
- Branch name format: `feature/<short-description>` or `fix/<short-description>`.
- Keep pull requests focused and small.

## Local Setup

- Backend: copy `backend/.env.example` to `backend/.env`.
- Frontend: copy `frontend/.env.example` to `frontend/.env`.
- Install dependencies in both `backend` and `frontend`.

## Quality Gates

Before opening a PR, run:

- Backend: `npm run lint`, `npm run test:cov`, `npm run build`
- Frontend: `npm run lint`, `npm run test:coverage`, `npm run build`

## Pull Request Checklist

- PR has a clear title and summary.
- Behavior changes are covered by tests.
- No secrets or local artifacts are committed.
- Documentation is updated when APIs/config change.

## Commit Message Guidance

Use clear, action-oriented messages:

- `feat: add tenant analytics endpoint`
- `fix: validate refresh token with config secret`
- `chore: add CI security audit job`
