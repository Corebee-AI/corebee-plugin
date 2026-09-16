<p align="center">
  <img src="assets/logo.svg" width="72" height="72" alt="Corebee logo">
</p>

<h1 align="center">Corebee plugin</h1>

<p align="center">
  Work your Corebee support inbox from your AI agent: triage conversations, send replies, look up customers, keep the knowledge base current and pull support reports.
</p>

<p align="center">
  Cursor · Grok Bot · Grok Build · Claude Code
</p>

<p align="center">
  <a href="https://github.com/Corebee-AI/corebee-plugin/actions/workflows/validate.yml"><img src="https://github.com/Corebee-AI/corebee-plugin/actions/workflows/validate.yml/badge.svg" alt="Validate"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2E7D6B" alt="MIT license"></a>
</p>

The plugin connects your agent to Corebee's hosted MCP server and adds six skills that tell the agent how to use it safely. You sign in with OAuth. There is no API key to paste.

## Quick start

1. Install the plugin for your client (see [Install](#install)).
2. Sign in when your client asks. Connecting the server opens a Corebee sign-in and consent page in your browser, before any tool runs. Where that happens depends on the client:
   - **Cursor:** use the install button on the marketplace listing, or run `/add-plugin corebee`. Cursor installs the plugin and opens the Corebee sign-in. If the browser did not open, find `corebee` under **Customize** in the sidebar, where Cursor manages its MCP servers, and connect it from there.
   - **Grok Bot:** add the plugin, then approve the connection when Grok Bot asks and finish the sign-in in your browser. If the sign-in window closed too early, reopen it from the plugin's entry. The plugin then appears under your installed plugins.
   - **Grok Build:** enable Corebee under `/plugins`, then finish the sign-in in your browser when Grok asks.
   - **Claude Code:** run `/mcp`, pick `corebee` and choose **Authenticate**, or run `claude mcp login corebee` from your shell. Claude Code shows the Corebee tools only after that.
3. Approve, then ask your agent something about your Corebee inbox, and review what the agent proposes before it changes anything.

## What you can ask

| Ask | Skill |
|---|---|
| "Go through my open Corebee conversations and suggest priorities and owners." | `corebee-inbox-triage` |
| "Draft a reply to Dana's latest conversation from our knowledge base. Show me before sending." | `corebee-reply-drafting` |
| "What do we know about dana@example.com before my call?" | `corebee-customer-lookup` |
| "Can our knowledge base answer these five questions? Add our new returns page if not." | `corebee-knowledge-base` |
| "Give me this month's support report with CSAT and a 30 day trend." | `corebee-support-report` |
| "Change our chat widget to our brand color and move it to the left." | `corebee-widget-setup` |

You can also ask for a single tool, for example "list my pending Corebee conversations" or "how many conversations did each agent resolve this week?".

## Install

You need a Corebee account ([sign up](https://corebee.ai/auth/signup)). When your client connects to the server, it opens a Corebee sign-in and consent page in your browser, before any tool runs.

### Cursor

- **Marketplace:** install Corebee from the Cursor Marketplace or from **Customize**. Cursor reviews each listing, so if Corebee is not listed yet, use one of the options below.
- **MCP server only:** [Add Corebee MCP to Cursor](https://cursor.com/install-mcp?name=corebee&config=eyJ1cmwiOiJodHRwczovL2NvcmViZWUuYWkvYXBpL3YxL21jcC9zdHJlYW0ifQ==). This adds the server without the skills and rule.
- **Local test:** copy this repository to `~/.cursor/plugins/local/corebee`, run **Developer: Reload Window**, then check **Customize**.

### Grok Bot

Open **Plugins**, search for Corebee and select **Add to Grok Bot**. Grok Bot uses the Cursor Marketplace listing, so there is nothing else to install. Corebee appears there once the Cursor listing is live.

### Grok Build

From the xAI catalog: open `/plugins` and install Corebee from the **Marketplace** tab. xAI reviews catalog entries, so if Corebee is not listed yet, install from this repository.

From this repository: clone it at the `v1.0.0` tag (or at a commit you reviewed) into `~/.grok/plugins/corebee`, or start Grok with `--plugin-dir <path to the clone>`. Then open `/plugins` and enable Corebee. Grok loads plugins from `./.grok/plugins/`, `~/.grok/plugins/` and any `--plugin-dir` path. This plugin ships one MCP server and six skills, with no hooks or scripts, so enabling it activates nothing that runs on your machine.

### Claude Code

```text
/plugin marketplace add Corebee-AI/corebee-plugin
/plugin install corebee@corebee
```

MCP server only:

```bash
claude mcp add --transport http corebee https://corebee.ai/api/v1/mcp/stream
```

Either way, run `/mcp`, pick `corebee` and choose **Authenticate** to sign in, or run `claude mcp login corebee` from your shell. Claude Code lists the Corebee tools only after that.

### Other MCP clients

Any client with streamable HTTP and OAuth works, as long as its callback is `https` or plain `http` on a loopback host (localhost, `127.0.0.1` or `[::1]`, any port). The one private app scheme Corebee also accepts is Cursor's own desktop callback, `cursor://anysphere.cursor-mcp/oauth/callback`. This is the same file the plugin ships as `mcp.json` and `.mcp.json`:

```json
{
  "mcpServers": {
    "corebee": {
      "type": "http",
      "url": "https://corebee.ai/api/v1/mcp/stream"
    }
  }
}
```

## What's included

| Component | Path | Hosts |
|---|---|---|
| Corebee MCP server (hosted, OAuth) | `mcp.json`, `.mcp.json` | all |
| Skills: inbox triage, reply drafting, customer lookup, knowledge base, support report, widget setup | `skills/` | all |
| Rule: safe use of Corebee tools (applied when a task involves Corebee) | `rules/corebee.mdc` | Cursor |
| Manifests | `.cursor-plugin/`, `.grok-plugin/`, `.claude-plugin/` | one per host |

No hooks, scripts, binaries or telemetry. `scripts/validate.mjs` runs only in CI and is never loaded by a host.

## Sign-in and permissions

- OAuth 2.1 with PKCE and Dynamic Client Registration. Your client finds the sign-in details itself and keeps the tokens. The plugin stores no credentials.
- A connection acts for you, in the Corebee workspace selected when you signed in. To connect another workspace, switch to it in Corebee first.
- Access tokens last 1 hour. Refresh tokens last 30 days and rotate on each use.
- **Access follows your role.** Whatever scopes the client asks for, a connection never gets more than your current role allows, and Corebee checks your role and membership again as requests come in (each server caches the result for at most 30 seconds). If your role is reduced, the connection is limited to the new role within about 30 seconds. If you leave the workspace, it stops working within about 30 seconds. A promotion does not widen an existing connection: reconnect to get the extra access.

| Role | Scopes a connection can hold |
|---|---|
| Owner | All 11 scopes |
| Agent | Read and write for conversations, contacts and knowledge, plus `metrics:read` and `settings:read`. No deletes, no settings changes. |
| Viewer | Read only: `conversations:read`, `contacts:read`, `knowledge:read`, `metrics:read`, `settings:read` |

A member whose role shows as `admin` (a legacy role that `list_team_members` can still return) has the Agent scopes.

| Scope | Allows |
|---|---|
| `conversations:read` | List, read and export conversations |
| `conversations:write` | Reply, add internal notes, assign, close, set priority, label, snooze and tag |
| `contacts:read` / `contacts:write` | Search and read contacts / create, update and add notes |
| `contacts:delete` | Delete contacts (their conversations, messages, CSAT responses, call records and other linked records are kept, without a contact) |
| `knowledge:read` / `knowledge:write` | List, read and search sources, and use the assistant tools / add and update web page sources |
| `knowledge:delete` | Delete knowledge sources |
| `metrics:read` | Metrics, trends and reports |
| `settings:read` / `settings:write` | Read widgets, team and workspace settings / change widget settings |

The consent screen lists the scopes you will get and any your role does not allow, with **Allow access** or **Cancel**. A client that sends no scope (this plugin's `mcp.json` requests none, and many clients send none) gets everything your role allows; the consent screen lists exactly that set. A client that asks only for scopes Corebee does not recognise gets read access only.

### Managing connected apps

In Corebee, open **Settings > Login & security > Connected apps** ([corebee.ai/settings/security](https://corebee.ai/settings/security)). This works for every role. You see the apps you connected and can revoke them. Owners see and can revoke every member's apps there, and also under **Settings > Connect to ChatGPT & Claude**. **Revoke** signs an app out within about 30 seconds, including its current access token. Removing the server in your client discards its copy of the tokens; the connection itself stays until it expires or you revoke it under **Settings > Login & security > Connected apps**.

An owner who wants a read-only connection has two options: connect from a client that lets you request only the read scopes, or connect as a member with the Viewer role.

## Tools

The hosted server lists every tool when your client connects (flat discovery, with no search step). Snapshot 2026-09-17: 42 tools (22 read-only, 17 write, 3 destructive). The same list, with parameters, is in [`scripts/tools.json`](scripts/tools.json), and CI checks that this table matches it.

### Conversations

| Tool | Scope | What it does |
|---|---|---|
| `list_conversations` | `conversations:read` | Up to 50 recent conversations per page, by status or assignee (`assignee_id`, a `member_id` from `list_team_members`) |
| `get_conversation` | `conversations:read` | One conversation with its newest 50 messages (oldest first within the page). When `has_more` is true, pass `before` = `next_before` to get the 50 messages before those |
| `bulk_export_conversations` | `conversations:read` | CSV of up to 25 conversations |
| `reply_to_conversation` | `conversations:write` | Send a reply on the conversation's channel, or save an internal note ([details](#replies)) |
| `assign_conversation` | `conversations:write` | Assign to a team member, or unassign |
| `close_conversation` | `conversations:write` | Mark resolved |
| `set_priority` | `conversations:write` | Low, medium, high or urgent |
| `add_label` | `conversations:write` | Add a label by ID. No tool lists labels, so you need the label ID |
| `bulk_close_conversations` | `conversations:write` | Resolve up to 25 |
| `bulk_snooze_conversations` | `conversations:write` | Snooze up to 25 until a set time |
| `bulk_tag_with_sentiment` | `conversations:write` | Tag up to 25 with a sentiment |
| `bulk_add_note` | `conversations:write` | Same internal note on up to 25 |

### Contacts

| Tool | Scope | What it does |
|---|---|---|
| `list_contacts` | `contacts:read` | 50 per page; search matches any part of a name or email, as typed, except that `*` matches any single character |
| `get_contact` | `contacts:read` | Details, custom attributes, latest notes and recent conversations |
| `create_contact` | `contacts:write` | Create a contact (email, phone or name required; a duplicate email or phone number is refused) |
| `update_contact` | `contacts:write` | Change only the fields you pass |
| `add_contact_note` | `contacts:write` | Internal note on a contact |
| `delete_contact` | `contacts:delete` | Destructive. Delete a contact and its notes; its conversations, messages, CSAT responses, call records and other linked records (for example NPS responses) are kept, unlinked ([two steps](#deletes)) |
| `bulk_delete_contacts` | `contacts:delete` | Destructive. Delete up to 25 contacts and their notes; their conversations, messages, CSAT responses, call records and other linked records are kept, unlinked |

### Knowledge base

| Tool | Scope | What it does |
|---|---|---|
| `list_knowledge_sources` | `knowledge:read` | Up to 50 sources with status and chunk counts |
| `get_knowledge_source` | `knowledge:read` | One source with its processing status |
| `search_knowledge` | `knowledge:read` | Text match over indexed content (not semantic search) |
| `add_knowledge_url` | `knowledge:write` | Add a web page; indexing runs in the background |
| `update_knowledge_source` | `knowledge:write` | Rename a source or change its URL |
| `delete_knowledge_source` | `knowledge:delete` | Destructive. Delete a source and everything indexed from it; knowledge gaps that pointed at it are kept, unlinked ([two steps](#deletes)) |

### Metrics and reports

| Tool | Scope | What it does |
|---|---|---|
| `get_metrics` | `metrics:read` | Conversation, contact, message and knowledge counts, CSAT and average first-response time |
| `get_agent_performance` | `metrics:read` | Assigned, resolved and resolution rate per team member |
| `get_channel_analytics` | `metrics:read` | Conversations and messages per channel |
| `get_trends` | `metrics:read` | 7, 30 or 90 day series by day or week |
| `export_report` | `metrics:read` | Counts only (`summary`), or up to 100 rows including contact details (`json`) |
| `export_report_task` | `metrics:read` | Counts-only report as a background MCP task |

### Widget and workspace settings

| Tool | Scope | What it does |
|---|---|---|
| `list_widgets` | `settings:read` | Your chat widgets with their `widget_id` |
| `get_widget_settings` | `settings:read` | Appearance and behavior of a widget |
| `list_team_members` | `settings:read` | Up to 50 members with role and `member_id` |
| `get_organization_settings` | `settings:read` | Plan, status and AI settings |
| `update_widget_settings` | `settings:write` | Color, welcome title, reply time and pre-chat form |
| `configure_widget_appearance` | `settings:write` | Color, welcome title, logo and position |
| `configure_widget_behavior` | `settings:write` | Reply time and pre-chat form |

### Assistants

Read-only helpers. Each takes a `task_description` (plus optional `context` and `history`) and returns `answered`, `response`, `confidence` and suggested `actions`. Nothing is executed or written. Three of the four use fixed keyword rules with no AI model.

| Tool | Scope | What it does |
|---|---|---|
| `a2a_knowledge_agent` | `knowledge:read` | Knowledge Agent (the only one that runs an AI model): finds up to 5 relevant indexed passages and writes a short answer from them only, naming the sources. If the model is unavailable it returns an excerpt of the best passage with lower `confidence`, so check `confidence` and the sources before relying on it. `answered` is false when nothing relevant was found or the search could not run, so confirm with `search_knowledge`. Limited to 30 calls a minute per workspace |
| `a2a_escalation_agent` | `knowledge:read` | Escalation Agent: keyword rules that flag a request for a person, frustration or a repeated issue in the text you pass, and suggest a handoff with a priority. It does not hand off or notify anyone |
| `a2a_diagnostic_agent` | `knowledge:read` | Diagnostic Agent: keyword rules for six areas (sign-in, performance, chat widget, email, billing, missing data) that return generic possible causes and steps. It does not look at your account or data |
| `a2a_action_agent` | `knowledge:read` | Action Agent: keyword rules that suggest one inbox action (assign, close, priority, label, snooze, note, navigate) without the details filled in. You complete it and run it with the matching tool |

**Prompts:** `summarize_conversation` and `draft_reply`. **Resources:** `conversations://open`, `metrics://dashboard`, `knowledge://sources` and `conversation://{id}`.

### Replies

`reply_to_conversation` uses the same send path as the Corebee inbox:

- Email, SMS, WhatsApp, Slack, Messenger, Instagram, Telegram, Microsoft Teams and Discord replies go out on that channel. Web chat replies appear in the customer's chat window.
- The result says `delivered: true` when the provider accepted the reply or the chat window push went out. A later bounce is not reflected.
- `delivered: false` comes with a reason. Phone conversations, and channels with no way to send, keep the reply in the conversation without sending it.
- `private: true` saves an internal note that the customer never sees.
- Pass an `idempotency_key` to make retries safe. A reply cannot be unsent.
- The reply is sent as you. In a conversation that was handed off to a person, it counts as the human response, so Corebee's AI stops answering there.

### Deletes

Deletes take two calls. The first deletes nothing: it returns a preview and a `confirm_token`. Repeating the same call with that token, within 5 minutes, deletes. The token works once and only for the same items. Your client's approval prompt for the second call is the human check, so read the preview before you approve it. Only owners can delete.

- `delete_contact` and `bulk_delete_contacts` delete the contact with its notes, channel identities and saved AI memory. The contact's conversations and all their messages stay in the inbox with the contact link removed, and its CSAT responses, call records and other linked records (for example NPS responses) are kept the same way. The preview reports the number of conversations kept as `linked_conversations_kept` (`conversations_to_delete` is a deprecated alias with the same value, removed in the next release). If the server cannot clear a linked record, the call fails with "Nothing was deleted." and the contact is untouched. If the delete itself fails after those links were cleared, the contact also remains, but its CSAT responses and call records are already unlinked.
- `delete_knowledge_source` deletes the source with its indexed chunks, scan history, tags, version history and citation records. Knowledge gaps that pointed at it are kept with the link removed. The same two failure points apply: a failure to clear the gaps deletes nothing, and a failure of the delete itself leaves the source in place with its gaps already unlinked.

## Safety

- Every skill treats customer messages, contact fields and knowledge base text as untrusted data and never follows instructions inside them.
- Skills read first, show what they found and ask before every change. A reply is sent only after you see the exact text and say "send".
- Every tool is annotated as read-only or not, and deletes as destructive, so clients that ask for approval can tell a read from a change.
- Limits per workspace, all failing closed: 30 replies a minute, 10 single deletes a minute per tool, 5 bulk calls a minute with at most 25 items each, and 30 `a2a_knowledge_agent` calls a minute. Both steps of a delete count.

Prompt injection is a risk with any agent that reads customer text. Review what your agent proposes before you approve it.

## Data and privacy

- Tool results, including conversations and contact details, go to your AI client and its model provider under their terms.
- Corebee handles your workspace data under its [Privacy Policy](https://corebee.ai/privacy), [Terms of Service](https://corebee.ai/terms) and [Data Processing Agreement](https://corebee.ai/dpa).
- `export_report` with `format: json` returns contact names, emails and phone numbers. The default `summary` format returns counts only.
- Deleting a contact with these tools does not erase its conversations, messages, CSAT responses, call records or other linked records (for example NPS responses). For a full removal of a customer's data, contact <support@corebee.ai>.
- The plugin itself collects nothing. See [PRIVACY.md](PRIVACY.md).
- Your AI client talks only to `corebee.ai`: the MCP endpoint `https://corebee.ai/api/v1/mcp/stream`, and Corebee's OAuth endpoints and discovery metadata on the same host. The sign-in and consent pages open in your browser and are ordinary Corebee web pages, covered by Corebee's [Privacy Policy](https://corebee.ai/privacy) and [Cookie Policy](https://corebee.ai/cookies), including any analytics loaded with your consent.

## Troubleshooting

| Problem | What to do |
|---|---|
| Sign-in does not return to Cursor | Cursor desktop returns to `cursor://anysphere.cursor-mcp/oauth/callback`, so let the browser open Cursor. |
| "redirect_uri must be https, or http on loopback only" | Your client registered a plain `http` callback on a remote host. Use a client with an `https` or loopback callback. |
| "no supported redirect_uri; use https or http loopback" | Your client offered only a custom app callback (a private scheme), which Corebee does not accept, other than Cursor's own desktop callback. Use a client with an `https` or loopback callback. |
| `401` or "needs login" | Reconnect the server to sign in again. This also happens shortly after an app is revoked (under **Settings > Login & security > Connected apps**) or you leave the workspace. |
| "Insufficient permissions. Required scope: ..." | Your role does not allow it, or your client asked only for read scopes. Ask an owner, or reconnect and let the client request write scopes (or no scope at all, which gives everything your role allows). |
| "This workspace has N widgets; pass widget_id." | Call `list_widgets` and pass the `widget_id` you want. |
| A delete returns `confirmation_required` | Expected. Review the preview, then approve the second call with the `confirm_token`. |
| "confirm_token is invalid, expired, already used..." | Call the delete again without a token to get a new preview. |
| "Error deleting contact" (or "Error deleting contacts" for the bulk tool) or "Error deleting knowledge source" after confirming | Nothing was deleted. Either the server could not clear a record linked to the item, or the delete itself failed after those links were cleared; in the second case the contact (or source) remains and its CSAT responses and call records (or knowledge gaps) are now unlinked. Start again from the preview; if it fails again, contact <support@corebee.ai>. |
| `set_priority`, `add_label` or `assign_conversation` fails with a missing value | Pass the value explicitly. The hosted server cannot ask for it. |
| `delivered: false` on a reply | Read the `reason`. For phone conversations, follow up in the Corebee inbox. |
| Rate limit error | Wait a minute and try again. |
| `add_knowledge_url` shows `pending` | Indexing runs in the background. Check again with `list_knowledge_sources`. |

## Support

- Email: <support@corebee.ai>
- Help center: <https://corebee.ai/help>
- Plugin bugs: [GitHub issues](https://github.com/Corebee-AI/corebee-plugin/issues)
- Pricing: the plugin is free and open source; you need a Corebee account ([pricing](https://corebee.ai/simple-predictable-pricing))

## Security

Report vulnerabilities privately to <jonathan@corebee.ai> or through [GitHub private vulnerability reporting](https://github.com/Corebee-AI/corebee-plugin/security/advisories/new). See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). The Corebee name and logo are trademarks of COREBEE CHAT LTD and are not licensed under MIT.
