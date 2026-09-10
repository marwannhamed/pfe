# Changelog

All notable changes to this project should be documented in this file.

This project follows:

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning](https://semver.org/)

## [Unreleased]

### Added
- CI workflow for backend/frontend checks.
- Security audit job in CI.
- Initial backend/frontend test coverage baseline.

### Changed
- Unified database configuration around PostgreSQL.
- Hardened JWT secret handling and refresh token flow.
- Hardened production Docker and compose configuration.

### Fixed
- Removed duplicate exception filter path usage.
- Improved repository hygiene with stronger `.gitignore`.
