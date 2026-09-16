# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x (latest release) | Yes |
| Older | No |

## Reporting a vulnerability

Please report security issues privately. Do not open a public GitHub issue.

- Email <jonathan@corebee.ai>, or
- Use [GitHub private vulnerability reporting](https://github.com/Corebee-AI/corebee-plugin/security/advisories/new) for this repository.

Include the affected file or tool, steps to reproduce, and the impact you expect. Remove access tokens and customer data from anything you send.

Corebee's disclosure policy, including scope, testing guidelines and response times, is at <https://corebee.ai/security#vulnerability-disclosure>. In short: do not access or change other customers' data, do not run destructive or denial-of-service tests against production, and give us reasonable time to fix an issue before public disclosure. We aim to acknowledge reports within 2 business days.

## Scope

- **This repository:** manifests, MCP configuration, skills, the Cursor rule, the validator and CI. For example: a skill that could lead an agent to take an unconfirmed action, or a manifest that points to the wrong server.
- **The Corebee service:** the hosted MCP server, OAuth endpoints and the Corebee app. Report these to <jonathan@corebee.ai> as well.

## What the plugin does and does not do

- It runs no code on your machine. There are no hooks, scripts or binaries for a host to load. `scripts/validate.mjs` only runs in CI and during development.
- It stores no credentials. Your AI client performs the OAuth flow and keeps the tokens.
- It sends no telemetry.
- It points your client at one remote MCP server, `https://corebee.ai/api/v1/mcp/stream`, and Corebee's OAuth endpoints.

## Access controls on Corebee's side

- A connection never holds more access than the signed-in user's current role allows, and role and membership are checked again as requests come in, with results cached for at most 30 seconds per server. Reducing a member's role limits their connections, and removing a member ends them, within about 30 seconds. A promotion does not widen an existing connection until the member reconnects.
- Every tool call checks the scope it needs.
- Deletes take two calls: a preview first, then a confirmation that is valid once, for 5 minutes, for the same items only.
- Every user can see and revoke the apps they connected under **Settings > Login & security > Connected apps** ([corebee.ai/settings/security](https://corebee.ai/settings/security)). Owners see and can revoke every member's apps there, and also under **Settings > Connect to ChatGPT & Claude**. A revoke takes effect within about 30 seconds, including for the app's current access token.
- Replies, deletes and bulk tools are rate limited per workspace.
- Access tokens expire after 1 hour and are bound to the Corebee MCP server. Refresh tokens rotate on each use.

## If a token may be exposed

Revoke the app in Corebee under **Settings > Login & security > Connected apps** ([corebee.ai/settings/security](https://corebee.ai/settings/security)), which every role can open. Then remove the Corebee connection in your client, and reconnect if you still need it. Contact <support@corebee.ai> if you need help.
