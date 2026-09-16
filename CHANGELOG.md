# Changelog

All notable changes to this plugin are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin uses [Semantic Versioning](https://semver.org/).

## 1.0.0 (2026-09-17, initial release)

### Added

- Corebee MCP server `https://corebee.ai/api/v1/mcp/stream` over streamable HTTP, with OAuth 2.1, Dynamic Client Registration and PKCE. No API key.
- Skills: `corebee-inbox-triage`, `corebee-reply-drafting`, `corebee-customer-lookup`, `corebee-knowledge-base`, `corebee-support-report` and `corebee-widget-setup`.
- Cursor rule `rules/corebee.mdc` for safe use of Corebee tools. It is not always on; Cursor's agent applies it when a task involves Corebee.
- Manifests for Cursor (`.cursor-plugin/`), Grok Build (`.grok-plugin/`) and Claude Code (`.claude-plugin/`, including a one-plugin marketplace).
- Tool snapshot `scripts/tools.json` (42 tools, 2 prompts and 4 resources, flat discovery) with parameters, role scope ceilings and counts, and a zero-dependency validator that runs in CI. The validator checks that every tool named in the README, skills and rule exists in the snapshot, that the README lists every prompt and resource, that the manifests agree on version, description and category, and that no file names the wrong security contact. It scans the files tracked by git, so a local run sees what CI sees. An opt-in `--live` mode compares the snapshot with the hosted server's public server card and checks the security contact and disclosure redirect on corebee.ai.
- Logo: Corebee's official three-hexagon mark on a white tile with rounded corners and a transparent outside (`assets/logo.svg`, `assets/logo.png`, 512 by 512).
- `minClientVersions.cursor` is `3.13.0`, the floor most marketplace listings declare. The plugin is a hosted MCP server, skills and one rule, and uses no client feature newer than that.

No hooks, scripts or binaries are loaded by any host.
