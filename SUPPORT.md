# Support

Noir Note is maintained as an open-source project without a guaranteed response time or service
level agreement.

## Before opening an issue

1. Read the [quick start](README.md#quick-start) and
   [development guide](docs/DEVELOPMENT.md).
2. Search existing [issues](https://github.com/minkinad/noir-note/issues).
3. Run `npm run check` and, for desktop failures,
   `cargo check --manifest-path src-tauri/Cargo.toml`.
4. For startup or data problems, follow the [operations runbook](docs/operations/runbook.md) before
   modifying the database.

When reporting a problem, include the Noir Note version or commit, OS version, installation method,
steps to reproduce, expected/actual behavior, and sanitized logs. Never attach your
`workspace.sqlite3` file publicly: it contains note content in plain text.

Use a public issue for reproducible bugs and feature proposals. Use the private process in
[SECURITY.md](SECURITY.md) for vulnerabilities. General questions may be opened as a discussion if
GitHub Discussions is enabled; otherwise use a clearly labelled question issue.
