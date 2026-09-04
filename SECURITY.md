# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability
reporting/security-advisory feature for this repository. Include:

- the affected version, operating system, and component;
- prerequisites, expected impact, and minimal reproduction steps;
- relevant logs with note content, usernames, and filesystem paths removed;
- a suggested mitigation, if known.

Do not access data that is not yours, publish proof-of-concept exploits before a fix is available,
or retain copied user data. Maintainers will acknowledge a complete report as soon as practical and
coordinate disclosure after a fix or documented mitigation exists.

## Supported versions

Security fixes target the current `main` branch and the newest published release. Pre-release builds
and older `0.x` versions may require upgrading rather than a backport.

## Security model

Noir Note is an offline, single-user desktop application. Its current boundary is intentionally
limited:

- the Rust core owns filesystem and SQLite access;
- the WebView can invoke only commands registered by the application;
- Tauri capabilities grant only the window operations used by the UI;
- application data is not sent to a hosted Noir Note service;
- schema changes run through ordered migrations and writes use SQLite transactions.

The workspace database is **not encrypted by the application**. A user or process with access to
the operating-system account can read or modify it. Use full-disk encryption, a locked OS account,
trusted software, and protected backups when notes are sensitive.

## Maintainer release baseline

- Build from committed npm and Cargo lockfiles.
- Keep Tauri capabilities and the command surface least-privileged.
- Run `npm run check`, `cargo fmt --check`, and `cargo check` before release.
- Review dependency updates and generated installers before publication.
- Sign release artifacts when signing infrastructure is available.
- Never include a real workspace database, note content, local paths, or signing secrets in logs or
  artifacts.

See [Architecture](docs/ARCHITECTURE.md) and the
[operations runbook](docs/operations/runbook.md) for trust boundaries and recovery procedures.
