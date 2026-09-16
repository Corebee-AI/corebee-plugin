# Contributing

Thanks for helping improve the Corebee plugin.

## What belongs here

- Improvements to the skills in `skills/` and the Cursor rule in `rules/`.
- Documentation fixes.
- Fixes to manifests, the validator or CI.

Tool behavior (names, arguments, scopes, limits) belongs to Corebee's hosted MCP server, not this repository. Requests to change a tool are welcome as issues, but pull requests cannot change it here. New skills must use only tools that exist on the server today.

## Checks

Run the validator before you open a pull request. It needs Node.js 18 or later and has no dependencies. It checks the files tracked by git (the same set CI sees), or the whole directory when run outside a git checkout:

```bash
node scripts/validate.mjs --self-test
node scripts/validate.mjs
```

`node scripts/validate.mjs --live` adds a network check that compares the snapshot with the hosted server's public server card, and checks the security contact and the disclosure redirect on corebee.ai. It is not part of the default run or of CI, so an outage cannot block a docs pull request; maintainers run it at release time (see the checklist below).

CI also runs these checks, which you can run locally:

```bash
# Cursor manifest against Cursor's published schema. CI installs the same
# ajv versions with npm scripts off and checks their package hashes; locally, npx is fine.
curl -fsSL https://raw.githubusercontent.com/cursor/plugins/c1c0a32802223f4be824112dd83d33ad29a8b26c/schemas/plugin.schema.json -o /tmp/cursor-plugin.schema.json
npx --yes -p ajv-cli@5.0.0 -p ajv-formats@3.0.1 ajv validate --spec=draft7 -c ajv-formats -s /tmp/cursor-plugin.schema.json -d .cursor-plugin/plugin.json

# Claude Code manifest and marketplace (checks manifests only, not skill frontmatter).
# CI installs the same version with npm scripts off and checks the package hashes
# pinned in .github/workflows/validate.yml; locally, npx is fine.
npx --yes @anthropic-ai/claude-code@2.1.274 plugin validate --strict .
```

`scripts/validate.mjs` parses skill and rule frontmatter strictly: a value that contains `: ` or ` #` must be quoted.

Optional, if you have the Grok CLI installed: `grok plugin validate .`. CI does not install it.

## Style

- Plain, specific language. No marketing claims, statistics or certifications that cannot be verified.
- No em dashes or en dashes. The validator rejects them.
- Call the editor by its name, "Cursor", with nothing added after it.
- Skill folders and `name` fields start with `corebee-` and match each other.
- Skill frontmatter uses only `name` and `description`, so the same file works on every host.
- Every skill keeps the `## Safety rules` section, and any skill that uses a write tool asks for explicit confirmation first.
- Every tool name in the README, skills and rule must exist in `scripts/tools.json`, with or without backticks. When the server changes, regenerate the snapshot from the hosted server's `tools/list` (names, titles, annotations, scopes and parameters), update its date and counts, and update the README tool tables in the same pull request.
- No hooks, scripts or binaries for hosts to load.

## Releases

1. Bump `version` in `.cursor-plugin/plugin.json`, `.grok-plugin/plugin.json` and `.claude-plugin/plugin.json`. The validator checks that they match.
2. Add a `## <version>` section to `CHANGELOG.md`.
3. Check the pins at the top of `.github/workflows/validate.yml` (`CURSOR_PLUGINS_SHA`, `XAI_MARKETPLACE_SHA`, `AJV_CLI_VERSION` and `AJV_FORMATS_VERSION` with their `*_INTEGRITY` hashes, `CLAUDE_CODE_VERSION` with its two `CLAUDE_CODE_*_INTEGRITY` hashes; every hash comes from `npm view <package>@<version> dist.integrity`) and bump them by hand if newer versions exist. Dependabot updates only the pinned actions.
4. After merge, maintainers ask Cursor to re-index the listing and open a pull request to bump the pinned commit in the xAI plugin catalog. Both marketplaces review every update.

## Release checklist

Maintainers run this before every tag, including the first one. The README, `scripts/tools.json` and `SECURITY.md` describe the hosted server as it behaves at its current release, so the plugin is published only against a deployed server that matches them.

1. **The hosted server matches the snapshot.** On the deployed release, note the deployed commit and:
   - Run `node scripts/validate.mjs --live`. It checks that `https://corebee.ai/.well-known/mcp/server-card.json` reports `tool_discovery` flat, `tool_count` and `initial_tool_count` equal to the count in `scripts/tools.json`, the same tool categories (no `skills` category) and the same scopes; that `https://corebee.ai/.well-known/security.txt` lists the same contact as `SECURITY.md`; and that `https://corebee.ai/security/disclosure` returns a 308 whose `Location` resolves to `https://corebee.ai/security#vulnerability-disclosure` (the header itself is the relative `/security#vulnerability-disclosure`). Also open the `Policy` link in security.txt by hand.
   - Diff a connected client's `tools/list` against `scripts/tools.json`: names, parameters and required flags. Read the descriptions of `get_conversation` (must offer `before`), `delete_contact` (must say conversations are kept) and the four `a2a_*` tools (must say which ones are fixed keyword rules) against the README tables.
   - `prompts/list` must return exactly the prompts in `scripts/tools.json` and `resources/list` exactly the resources listed there. The snapshot lists only `summarize_conversation` and `draft_reply`, and no `ui://` resources, which is what the hosted server lists when its optional prompt hints and app views are off. Do not assume those settings: run the two lists. If the server lists more, add them to `scripts/tools.json` and to the README Prompts and Resources line.
   - Every statement in the README sections "Sign-in and permissions", "Replies" and "Deletes", and in `SECURITY.md` "Access controls on Corebee's side", holds when tried with a test account of each role on a demo workspace. Connect once from a client that sends no `scope` and confirm the consent screen lists the role's full set. Run one reply that returns `delivered: true`.
   - Run one two-step delete on a test contact that has at least one CSAT response and one call record. The preview must include `linked_conversations_kept` and say that its conversations and their messages are kept, and the confirmed call must succeed and leave those records in place without a contact.
   - Do one local install per host (Cursor from `~/.cursor/plugins/local/corebee`, Claude Code with `/plugin marketplace add <path to the clone>`, Grok Build with `--plugin-dir`) and check that the README Quick start matches what each host actually showed. The README deliberately avoids naming host buttons that have not been seen on a real host; if a host behaves differently from the README, fix the README in the same release. The Cursor floor in `.cursor-plugin/plugin.json` (`minClientVersions.cursor`) stays at `3.13.0` unless the plugin starts using a newer client feature; do not raise it to the version you tested on.
2. **History.** Publish one reviewed commit per release with a short, changelog-style public message and no internal trailers or references (no session links, no `Co-Authored-By`, no pull request or hostname mentions). Working history is squashed before the push, never rewritten after it. On the first release, replace the whole local history with one commit from the current tree and prove it before pushing:

   ```sh
   git reset --soft "$(git rev-list --max-parents=0 HEAD)" && git commit --amend -m "Corebee plugin 1.0.0"
   test "$(git rev-list --count HEAD)" = 1
   git log --all --format=%B | /usr/bin/grep -c -i -E 'Co-Authored-By|Session:|PR #|https?://'   # must print 0
   git grep -c -i "<maintainer personal handle>" $(git rev-list --all) -- ; echo "exit $?"   # must find nothing (exit 1)
   ```

   The local `pre-push` hook refuses a first push that carries more than one commit, a trailer, or a personal handle; keep it in place as the second net.
3. **Repository settings** (first release). Make the repository public, turn on private vulnerability reporting so the link in `SECURITY.md` works, and protect `main` (require the CI checks and code owner review, see `.github/CODEOWNERS`). GitHub honors a `CODEOWNERS` entry only for an account with write access, so give `CorebeeChat` (or a maintainers team) write access before turning on the code owner rule, then confirm the file shows no warning in the GitHub UI.
4. **Push and tag.** Push `main`, wait for CI to pass so the badge is green, then tag the release (for example `git tag v1.0.0`) and push the tag so the tag named in the README Grok Build section exists. Check that the raw `assets/logo.png` URL returns 200. On the first release, remove the `github.com/Corebee-AI/corebee-plugin` exclusion from the links job in `.github/workflows/validate.yml`.
5. **Screenshot** (first release). Add one screenshot or GIF of the triage table and the reply "send" confirmation to the README, taken in Cursor on a demo workspace with no real customer data.
6. **Submit.** Submit to the Cursor Marketplace, and open the xAI plugin catalog pull request pinned to the tagged commit SHA. Until those listings are live, the direct install commands in the README are the only working install paths.

   Within a day of a listing going live, update the README Install section in one commit: add `/add-plugin corebee` (the command the Cursor listing renders) as the first Cursor install line, remove the "if Corebee is not listed yet" sentences for Cursor and Grok Build and the "once the Cursor listing is live" sentence for Grok Bot, then ask Cursor to re-index the listing.

   The xAI entry goes into `.grok-plugin/marketplace.json` of `xai-org/plugin-marketplace` (then run their `scripts/generate-plugin-index.py` and `scripts/validate-catalog.py`). Replace `sha` with the full 40-character commit of the tag (`git rev-parse v1.0.0^{commit}`); xAI rejects tags and branches. Keywords and domains stay brand-scoped, because they drive Grok Build's plugin suggestion. The xAI catalog has no fixed category list, so `integrations` matches the other manifests even though no other entry uses it yet:

   ```json
   {
     "name": "corebee",
     "description": "Work your Corebee support inbox: triage and answer web chat, WhatsApp, email and SMS conversations, look up customers and update the knowledge base.",
     "category": "integrations",
     "source": {
       "source": "url",
       "url": "https://github.com/Corebee-AI/corebee-plugin.git",
       "sha": "<full commit sha of the v1.0.0 tag>"
     },
     "homepage": "https://github.com/Corebee-AI/corebee-plugin",
     "keywords": ["corebee", "corebee mcp", "corebee support"],
     "domains": ["corebee.ai"]
   }
   ```

When the server changes a behavior that the README, the rule or a skill describes, update the plugin in the same release.

## Code of conduct

This project follows the [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Report conduct issues to <support@corebee.ai>.
