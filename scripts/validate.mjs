// Validates the Corebee plugin repository for Cursor, Grok Build and Claude Code.
//
// Usage:
//   node scripts/validate.mjs              validate the repository
//   node scripts/validate.mjs --self-test  prove every check can fail
//   node scripts/validate.mjs --live       also compare the snapshot with the hosted server
//                                          (network; opt-in so an outage cannot block a docs PR)
//
// Node.js 18 or later. No dependencies. Exits 1 on any error.

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CURSOR_KEYS = new Set([
  'name', 'displayName', 'description', 'version', 'minClientVersions', 'author',
  'publisher', 'homepage', 'repository', 'license', 'logo', 'keywords', 'category',
  'tags', 'commands', 'agents', 'skills', 'rules', 'hooks', 'variables', 'mcpServers',
]);
const CURSOR_CLIENTS = new Set(['cursor', 'grokbot', 'sand']);
const CLAUDE_FORBIDDEN_KEYS = ['logo', 'category', 'tags', 'publisher', 'rules'];
// Components that can run code or change host behavior. The plugin ships none,
// and an inline object in a manifest would bypass the path checks below.
const MANIFEST_FORBIDDEN_KEYS = ['hooks', 'lspServers', 'agents', 'commands'];
const SHARED_KEYS = ['name', 'version', 'description', 'homepage', 'repository', 'license'];
const SKILL_KEYS = new Set(['name', 'description', 'license', 'metadata']);
const NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const IDENT_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;
// Words shaped like a Corebee tool name. Any such word in the README, a skill
// or a rule must be a tool (or prompt) in scripts/tools.json, even outside
// backticks, so a renamed or removed tool cannot linger in the docs.
const TOOL_SHAPE_RE = /\b(?:list|get|create|update|delete|bulk|add|search|set|assign|close|reply|export|configure|summarize|skill|a2a|generate)_[a-z0-9]+(?:_[a-z0-9]+)*\b/g;
const TOOL_ACCESS = new Set(['read', 'write', 'destructive']);
const MCP_EXPECTED = {
  mcpServers: { corebee: { type: 'http', url: 'https://corebee.ai/api/v1/mcp/stream' } },
};
// Cursor and Claude Code both take a category; the plugin is an integration on
// every host, not a productivity tool.
const PLUGIN_CATEGORY = 'integrations';
// The hosted server card names the assistants category "a2a" (the tool prefix).
const GROUP_TO_CATEGORY = { assistants: 'a2a' };
const LIVE = {
  card: 'https://corebee.ai/.well-known/mcp/server-card.json',
  securityTxt: 'https://corebee.ai/.well-known/security.txt',
  disclosure: 'https://corebee.ai/security/disclosure',
  disclosureTarget: 'https://corebee.ai/security#vulnerability-disclosure',
  securityContact: 'jonathan@corebee.ai',
};
const FORBIDDEN_PATHS = [
  [/^plugin\.json$/, 'root plugin.json (Grok would read it before .grok-plugin)'],
  [/^hooks\//, 'hooks/ directory'],
  [/^bin\//, 'bin/ directory'],
  [/^settings\.json$/, 'root settings.json'],
  [/(^|\/)package(-lock)?\.json$/, 'package.json or lockfile (hosts may auto-install)'],
  [/(^|\/)server\.json$/, 'server.json (registry namespace not decided)'],
  [/^agents\//, 'agents/ directory (not shipped in v1)'],
  [/^commands\//, 'commands/ directory (not shipped in v1)'],
  [/^\.lsp\.json$/, 'root .lsp.json (LSP servers run local commands)'],
  [/^\.cursor-plugin\/marketplace\.json$/, '.cursor-plugin/marketplace.json (only for multi-plugin repos)'],
  [/^skills\/[^/]+\/(?!SKILL\.md$)/, 'file in a skill folder other than SKILL.md (skills ship no scripts or assets)'],
];
const GITHUB_OWNERS = new Set(['Corebee-AI', 'cursor', 'xai-org', 'actions', 'lycheeverse']);
// Prose and config files get every check. Every other non-binary file (this
// script, the SVG logo, dotfiles, any future text file) gets the secret and
// internal-host checks. Patterns that would match their own source are built
// from pieces so this file can be scanned too.
const PROSE_EXT = /\.(md|mdc|json|ya?ml)$/;
const SECRETS_AND_HOSTS = [
  [/(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/, 'secret pattern (sk-)'],
  [/ghp_[A-Za-z0-9]{20,}/, 'secret pattern (ghp_)'],
  [/github_pat_[A-Za-z0-9_]{20,}/, 'secret pattern (github_pat_)'],
  [/xox[abposr]-[A-Za-z0-9-]{10,}/, 'secret pattern (xox)'],
  [/AKIA[0-9A-Z]{16}/, 'secret pattern (AKIA)'],
  [new RegExp('-----' + 'BEGIN'), 'private key block'],
  [new RegExp('eyJhb' + 'Gci'), 'encoded JWT header'],
  [new RegExp('eyJ0e' + 'XAi'), 'encoded JWT header'],
  [new RegExp('ek_' + '(live|test)_[0-9a-f]{32,}'), 'secret pattern (Corebee API key)'],
  // Loopback URLs (host followed by a port or path) only; the bare word may appear in prose.
  [new RegExp('local' + 'host(:\\d|/)', 'i'), 'loopback host reference'],
  [new RegExp('vercel' + '\\.app'), 'internal hostname (Vercel preview)'],
  [new RegExp('supabase' + '\\.co'), 'internal hostname (database host)'],
  [new RegExp('fly' + '\\.dev'), 'internal hostname (Fly app)'],
];
const PROSE_ONLY = [
  [/\u2014/, 'em dash'],
  [/\u2013/, 'en dash'],
  // SECURITY.md names one security contact; every file must use the same one. Built from pieces so this file can be scanned too.
  [new RegExp('security' + '@corebee\\.ai'), 'not the security contact in SECURITY.md (use jonathan@corebee.ai)'],
  [new RegExp('Cursor ' + '(AI|Code)\\b'), 'wrong product name for Cursor'],
  [/\bSOC ?2\b/i, 'certification claim'],
  [/https:\/\/corebee\.ai\/docs(?!\/)/, 'link target not published (corebee.ai/docs)'],
  [/https:\/\/corebee\.ai\/mcp\b/, 'link target not published (corebee.ai/mcp)'],
];
// Listing limits: Cursor's marketplace page cuts skill descriptions at 280 characters and
// previews of the plugin description at about 150, so the manifests stay under both.
const SKILL_DESCRIPTION_MAX = 250;
const PLUGIN_DESCRIPTION_MAX = 150;
// YAML indicator characters that cannot start a plain (unquoted) scalar.
const YAML_INDICATOR_START = /^[-?:,[\]{}#&*!|>'"%@`]/;

// ---------- repository loading ----------

// Inside a git checkout, validate exactly the files git tracks (plus staged
// additions), so a local run sees what CI sees: an untracked .env or a stray
// package.json is neither scanned locally nor shipped. Outside a checkout, or
// if git is unavailable, walk the directory.
function trackedFiles(root) {
  if (!existsSync(join(root, '.git'))) return null;
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--exclude-standard'], { encoding: 'utf8' });
    const list = out.split('\0').filter(Boolean);
    return list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

function loadEntry(files, rel, abs) {
  const st = lstatSync(abs);
  if (st.isSymbolicLink()) files.set(rel, { buf: Buffer.alloc(0), exec: false, symlink: true });
  else if (st.isFile()) files.set(rel, { buf: readFileSync(abs), exec: (st.mode & 0o111) !== 0 });
}

function loadRepo(root) {
  const files = new Map();
  const tracked = trackedFiles(root);
  if (tracked) {
    for (const rel of tracked) {
      // A tracked file deleted from the working tree is skipped.
      try { loadEntry(files, rel, join(root, rel)); } catch { /* deleted locally */ }
    }
    return files;
  }
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const abs = join(dir, entry.name);
      const rel = abs.slice(root.length + 1).split('\\').join('/');
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(abs);
      else loadEntry(files, rel, abs);
    }
  };
  walk(root);
  return files;
}

const text = (repo, p) => (repo.has(p) ? repo.get(p).buf.toString('utf8') : null);

function parseJson(repo, p) {
  try { return JSON.parse(text(repo, p)); } catch { return undefined; }
}

function parseFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) return null;
  const data = {};
  const bad = [];
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) { bad.push(line); continue; }
    let v = kv[2].trim();
    if (v.startsWith('"')) {
      // A JSON string is a valid YAML double-quoted scalar; anything else is refused.
      try { v = JSON.parse(v); } catch { bad.push(`${kv[1]}: invalid double-quoted value`); continue; }
      if (typeof v !== 'string') { bad.push(`${kv[1]}: invalid double-quoted value`); continue; }
    } else if (v.startsWith("'")) {
      if (!/^'([^']|'')*'$/.test(v)) { bad.push(`${kv[1]}: invalid single-quoted value`); continue; }
      v = v.slice(1, -1).replace(/''/g, "'");
    } else if (v === 'true') v = true;
    else if (v === 'false') v = false;
    else if (v === '' || YAML_INDICATOR_START.test(v) || v.includes(': ') || v.endsWith(':') || v.includes(' #')) {
      // Strict YAML parsers reject or reinterpret these as plain scalars.
      bad.push(`${kv[1]}: value must be quoted (contains ": ", " #", ends with ":" or starts with a YAML indicator)`);
      continue;
    }
    data[kv[1]] = v;
  }
  return { data, body: m[2], bad };
}

function sectionBody(src, heading) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) return null;
  const level = heading.match(/^#+/)[0].length;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const h = /^(#+)\s/.exec(lines[i]);
    if (h && h[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function checkRelPath(ctx, label, value, repo) {
  const ok = typeof value === 'string' && value.length > 0 && !value.startsWith('/')
    && !value.split('/').includes('..') && !/^[A-Za-z]:/.test(value);
  ctx.check(ok, `${label}: path must be relative with no ".." (got ${JSON.stringify(value)})`);
  if (ok) {
    const norm = posix.normalize(value);
    ctx.check(repo.has(norm), `${label}: ${value} does not exist`);
  }
}

// ---------- validation ----------

export function validate(repo) {
  const errors = [];
  let count = 0;
  const ctx = { check(cond, msg) { count++; if (!cond) errors.push(msg); } };

  // 1. JSON parses
  for (const p of repo.keys()) {
    if (p.endsWith('.json')) ctx.check(parseJson(repo, p) !== undefined, `${p}: invalid JSON`);
  }

  const toolsDoc = parseJson(repo, 'scripts/tools.json') || {};
  const tools = Array.isArray(toolsDoc.tools) ? toolsDoc.tools : [];
  ctx.check(tools.length > 0, 'scripts/tools.json: no tools listed');
  const toolByName = new Map(tools.map((t) => [t.name, t]));
  ctx.check(toolByName.size === tools.length, 'scripts/tools.json: duplicate tool names');
  const prompts = toolsDoc.prompts || [];
  const resources = Array.isArray(toolsDoc.resources) ? toolsDoc.resources : [];
  for (const r of resources) ctx.check(typeof r === 'string' && /^[a-z]+:\/\//.test(r), `scripts/tools.json: bad resource ${JSON.stringify(r)}`);
  const params = tools.flatMap((t) => (Array.isArray(t.params) ? t.params : []));
  const knownIdents = new Set([
    ...toolByName.keys(), ...prompts, ...(toolsDoc.known_terms || []),
    ...params.map((p) => p.name), ...params.flatMap((p) => p.enum || []),
  ]);
  const callable = new Set([...toolByName.keys(), ...prompts]);
  // Parameter names and enum values come from the server itself, so a
  // tool-shaped one (for example reply_time) is not a stale tool reference.
  const serverTerms = new Set([...params.map((p) => p.name), ...params.flatMap((p) => p.enum || [])]);
  const forbidden = toolsDoc.forbidden || [];
  const writeTools = tools.filter((t) => t.access !== 'read').map((t) => t.name);
  const scopes = new Set(toolsDoc.scopes || []);
  for (const t of tools) {
    ctx.check(typeof t.name === 'string' && IDENT_RE.test(t.name), `scripts/tools.json: bad tool name ${JSON.stringify(t.name)}`);
    ctx.check(TOOL_ACCESS.has(t.access), `scripts/tools.json: ${t.name} has unknown access "${t.access}"`);
    ctx.check(scopes.has(t.scope), `scripts/tools.json: ${t.name} has unknown scope "${t.scope}"`);
    ctx.check(Array.isArray(t.params), `scripts/tools.json: ${t.name} has no params list`);
    ctx.check(!forbidden.includes(t.name), `scripts/tools.json: ${t.name} is both a tool and forbidden`);
  }
  for (const term of toolsDoc.known_terms || []) {
    ctx.check(!new RegExp(TOOL_SHAPE_RE.source).test(term), `scripts/tools.json: known term "${term}" looks like a tool name; tools belong in "tools"`);
  }
  const counts = toolsDoc.counts || {};
  const by = (a) => tools.filter((t) => t.access === a).length;
  ctx.check(counts.total === tools.length && counts.read === by('read') && counts.write === by('write') && counts.destructive === by('destructive'),
    'scripts/tools.json: "counts" does not match the tools list');
  for (const [role, list] of Object.entries(toolsDoc.role_scopes || {})) {
    for (const sc of list) ctx.check(scopes.has(sc), `scripts/tools.json: role ${role} lists unknown scope "${sc}"`);
  }

  // 2. Cursor manifest
  const cursor = parseJson(repo, '.cursor-plugin/plugin.json');
  ctx.check(cursor && typeof cursor === 'object', '.cursor-plugin/plugin.json: missing or invalid');
  if (cursor) {
    for (const k of Object.keys(cursor)) ctx.check(CURSOR_KEYS.has(k), `.cursor-plugin/plugin.json: key "${k}" is not allowed by Cursor's schema`);
    ctx.check(typeof cursor.name === 'string' && NAME_RE.test(cursor.name), '.cursor-plugin/plugin.json: name must be lowercase letters, digits and hyphens');
    for (const k of Object.keys(cursor.author || {})) ctx.check(k === 'name' || k === 'email', `.cursor-plugin/plugin.json: author.${k} is not allowed by Cursor's schema`);
    for (const [client, v] of Object.entries(cursor.minClientVersions || {})) {
      ctx.check(CURSOR_CLIENTS.has(client), `.cursor-plugin/plugin.json: unknown client "${client}" in minClientVersions`);
      ctx.check(v === 'never' || SEMVER_RE.test(v), `.cursor-plugin/plugin.json: minClientVersions.${client} must be semver or "never"`);
      if (client !== 'cursor') ctx.check(v !== 'never', `.cursor-plugin/plugin.json: minClientVersions.${client} "never" would hide the Grok Bot listing`);
    }
    ctx.check(typeof cursor.description === 'string' && cursor.description.length > 0 && cursor.description.length <= PLUGIN_DESCRIPTION_MAX, `.cursor-plugin/plugin.json: description must be 1 to ${PLUGIN_DESCRIPTION_MAX} characters (listing previews cut it)`);
    checkRelPath(ctx, '.cursor-plugin/plugin.json logo', cursor.logo, repo);
    checkRelPath(ctx, '.cursor-plugin/plugin.json mcpServers', cursor.mcpServers, repo);
  }

  // 3. Claude manifest
  const claude = parseJson(repo, '.claude-plugin/plugin.json');
  ctx.check(claude && typeof claude === 'object', '.claude-plugin/plugin.json: missing or invalid');
  if (claude) {
    for (const k of CLAUDE_FORBIDDEN_KEYS) ctx.check(!(k in claude), `.claude-plugin/plugin.json: "${k}" fails claude plugin validate --strict`);
    checkRelPath(ctx, '.claude-plugin/plugin.json mcpServers', claude.mcpServers, repo);
  }

  // 4. Grok manifest
  const grok = parseJson(repo, '.grok-plugin/plugin.json');
  ctx.check(grok && typeof grok === 'object', '.grok-plugin/plugin.json: missing or invalid');
  if (grok) {
    ctx.check(Array.isArray(grok.keywords) && grok.keywords.length > 0, '.grok-plugin/plugin.json: keywords missing');
    for (const kw of grok.keywords || []) ctx.check(String(kw).includes('corebee'), `.grok-plugin/plugin.json: keyword "${kw}" is not brand-scoped`);
    for (const k of ['skills', 'commands', 'agents']) ctx.check(!(k in grok), `.grok-plugin/plugin.json: "${k}" would replace default discovery`);
    if (grok.logo !== undefined) checkRelPath(ctx, '.grok-plugin/plugin.json logo', grok.logo, repo);
    checkRelPath(ctx, '.grok-plugin/plugin.json mcpServers', grok.mcpServers, repo);
  }

  // 4b. No code-running components in any manifest
  for (const [label, m] of [['.cursor-plugin/plugin.json', cursor], ['.grok-plugin/plugin.json', grok], ['.claude-plugin/plugin.json', claude]]) {
    if (!m) continue;
    for (const k of MANIFEST_FORBIDDEN_KEYS) ctx.check(!(k in m), `${label}: "${k}" is not allowed (the plugin ships no ${k})`);
  }

  // 5. Consistency
  const manifests = [['cursor', cursor], ['grok', grok], ['claude', claude]].filter(([, m]) => m);
  for (const key of SHARED_KEYS) {
    const values = new Set(manifests.map(([, m]) => JSON.stringify(m[key])));
    ctx.check(values.size === 1, `plugin.json: "${key}" differs between manifests`);
  }
  const version = cursor?.version;
  ctx.check(typeof version === 'string' && SEMVER_RE.test(version), 'plugin.json: version must be semver');
  const changelog = text(repo, 'CHANGELOG.md') || '';
  ctx.check(version && new RegExp(`^## ${version.replace(/\./g, '\\.')}(\\s|$)`, 'm').test(changelog), `CHANGELOG.md: no "## ${version}" heading`);
  const market = parseJson(repo, '.claude-plugin/marketplace.json');
  ctx.check(market && Array.isArray(market.plugins) && market.plugins.length === 1, '.claude-plugin/marketplace.json: must list exactly one plugin');
  ctx.check(cursor?.category === PLUGIN_CATEGORY, `.cursor-plugin/plugin.json: category must be "${PLUGIN_CATEGORY}"`);
  if (market?.plugins?.[0]) {
    ctx.check(market.plugins[0].name === cursor?.name, '.claude-plugin/marketplace.json: plugin name differs from manifests');
    ctx.check(market.plugins[0].category === PLUGIN_CATEGORY, `.claude-plugin/marketplace.json: plugin category must be "${PLUGIN_CATEGORY}" (same as the Cursor manifest)`);
    ctx.check(market.plugins[0].source === './', '.claude-plugin/marketplace.json: plugin source must be "./"');
    for (const key of ['description', 'homepage', 'repository', 'license']) {
      ctx.check(market.plugins[0][key] === cursor?.[key], `.claude-plugin/marketplace.json: plugin "${key}" differs from the manifests`);
    }
    ctx.check(typeof market.owner?.name === 'string', '.claude-plugin/marketplace.json: owner.name missing');
  }

  // 6. MCP files
  const mcpA = repo.get('mcp.json');
  const mcpB = repo.get('.mcp.json');
  ctx.check(mcpA && mcpB, 'mcp.json and .mcp.json must both exist');
  if (mcpA && mcpB) {
    ctx.check(mcpA.buf.equals(mcpB.buf), 'mcp.json and .mcp.json must be byte-identical');
    ctx.check(isDeepStrictEqual(parseJson(repo, 'mcp.json'), MCP_EXPECTED), 'mcp.json: must contain only the Corebee http server URL');
    ctx.check(!mcpA.buf.includes('${') && !mcpB.buf.includes('${'), 'mcp.json: variable placeholders are not allowed');
  }

  // 7. Forbidden paths and executables
  for (const [p, f] of repo) {
    ctx.check(!f.symlink, `${p}: symlinks are not allowed`);
    for (const [re, label] of FORBIDDEN_PATHS) ctx.check(!re.test(p), `${p}: not allowed (${label})`);
    ctx.check(!f.exec, `${p}: executable bit is not allowed`);
  }

  // 8. Skills
  const skillDirs = new Set([...repo.keys()].filter((p) => p.startsWith('skills/')).map((p) => p.split('/')[1]));
  ctx.check(skillDirs.size > 0, 'skills/: no skills found');
  for (const dir of skillDirs) {
    const p = `skills/${dir}/SKILL.md`;
    const src = text(repo, p);
    ctx.check(src !== null, `${p}: missing`);
    if (src === null) continue;
    const fm = parseFrontmatter(src);
    ctx.check(fm !== null, `${p}: missing frontmatter`);
    if (!fm) continue;
    ctx.check(fm.bad.length === 0, `${p}: unsupported frontmatter lines: ${fm.bad.join(' | ')}`);
    for (const k of Object.keys(fm.data)) ctx.check(SKILL_KEYS.has(k), `${p}: frontmatter key "${k}" is not portable across hosts`);
    const { name, description } = fm.data;
    ctx.check(name === dir, `${p}: name "${name}" must equal folder "${dir}"`);
    ctx.check(typeof name === 'string' && name.startsWith('corebee-') && name.length <= 64 && !name.includes('--') && NAME_RE.test(name), `${p}: name must be corebee-prefixed kebab-case, at most 64 characters`);
    ctx.check(typeof description === 'string' && description.length >= 20 && description.length <= SKILL_DESCRIPTION_MAX, `${p}: description must be 20 to ${SKILL_DESCRIPTION_MAX} characters (marketplace listings cut skill descriptions at 280)`);
    ctx.check(fm.body.split('\n').length <= 500, `${p}: body is longer than 500 lines`);
    ctx.check(fm.body.includes('## Safety rules'), `${p}: missing "## Safety rules" section`);
    ctx.check(fm.body.includes('untrusted data'), `${p}: safety rules must mention untrusted data`);
    const toolsUsed = sectionBody(fm.body, '## Tools used');
    ctx.check(toolsUsed !== null, `${p}: missing "## Tools used" section`);
    for (const m of (toolsUsed || '').matchAll(/`([^`\n]+)`/g)) {
      ctx.check(toolByName.has(m[1]), `${p}: "Tools used" lists \`${m[1]}\`, which is not a tool in scripts/tools.json`);
    }
    if (writeTools.some((t) => new RegExp(`\\b${t}\\b`).test(fm.body))) {
      ctx.check(/explicit/i.test(fm.body) && /confirm/i.test(fm.body), `${p}: uses write tools but never asks for explicit confirmation`);
    }
  }

  // 9. Rules
  for (const p of repo.keys()) {
    if (!/^rules\/[^/]+\.mdc$/.test(p)) continue;
    const fm = parseFrontmatter(text(repo, p));
    ctx.check(fm && typeof fm.data.description === 'string' && fm.data.description.length > 0, `${p}: description required`);
    ctx.check(fm && typeof fm.data.alwaysApply === 'boolean', `${p}: alwaysApply must be true or false`);
  }

  // 10. Tool references
  const docFiles = [...repo.keys()].filter((p) => /^skills\/.+\.md$/.test(p) || /^rules\/.+\.mdc$/.test(p) || p === 'README.md');
  for (const p of docFiles) {
    const src = text(repo, p);
    const inline = src.replace(/```[\s\S]*?```/g, '');
    for (const m of inline.matchAll(/`([^`\n]+)`/g)) {
      const id = m[1].trim();
      if (IDENT_RE.test(id)) ctx.check(knownIdents.has(id), `${p}: \`${id}\` is not a Corebee tool, prompt or known argument`);
    }
    // Anything shaped like a tool name, anywhere in the file, must be a real tool.
    for (const m of src.matchAll(TOOL_SHAPE_RE)) {
      ctx.check(callable.has(m[0]) || serverTerms.has(m[0]), `${p}: "${m[0]}" is not a tool or prompt in scripts/tools.json`);
    }
    // Agents read code blocks in skills and rules as instructions too, so every
    // snake_case word inside a fence must be known. README install blocks are exempt.
    if (p === 'README.md') continue;
    for (const fence of src.matchAll(/```[\s\S]*?```/g)) {
      for (const w of fence[0].matchAll(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g)) {
        ctx.check(knownIdents.has(w[0]), `${p}: "${w[0]}" in a code block is not a Corebee tool, prompt or known argument`);
      }
    }
  }
  const mdFiles = [...repo.keys()].filter((p) => /\.(md|mdc)$/.test(p));
  for (const p of mdFiles) {
    const src = text(repo, p);
    for (const name of forbidden) ctx.check(!new RegExp(`\\b${name}\\b`).test(src), `${p}: mentions "${name}", which is not a live tool`);
  }

  // 11. README tools table matches the snapshot
  const readme = text(repo, 'README.md') || '';
  const toolsSection = sectionBody(readme, '## Tools');
  ctx.check(toolsSection !== null, 'README.md: missing "## Tools" section');
  if (toolsSection !== null) {
    const listed = new Set([...toolsSection.matchAll(/^\| `([a-z0-9_]+)`/gm)].map((m) => m[1]));
    const expected = new Set(toolByName.keys());
    for (const n of expected) ctx.check(listed.has(n), `README.md: tools table is missing "${n}"`);
    for (const n of listed) ctx.check(expected.has(n), `README.md: tools table lists "${n}", which is not in scripts/tools.json`);
    const summary = `Snapshot ${toolsDoc.snapshot_date}: ${tools.length} tools (${by('read')} read-only, ${by('write')} write, ${by('destructive')} destructive)`;
    ctx.check(toolsSection.includes(summary), `README.md: tool summary must read "${summary}"`);
    const promptsLine = (toolsSection.match(/^\*\*Prompts:\*\*.*$/m) || [''])[0];
    const listedPrompts = new Set([...promptsLine.matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]));
    for (const n of prompts) ctx.check(listedPrompts.has(n), `README.md: Prompts line is missing "${n}"`);
    for (const n of listedPrompts) ctx.check(prompts.includes(n), `README.md: Prompts line lists "${n}", which is not in scripts/tools.json`);
    // Resources: the snapshot must list some, and the README line must match it both ways.
    ctx.check(resources.length > 0, 'scripts/tools.json: no resources listed');
    const resourcesLine = (toolsSection.match(/\*\*Resources:\*\*.*$/m) || [''])[0];
    const listedResources = new Set([...resourcesLine.matchAll(/`([^`\s]+:\/\/[^`\s]*)`/g)].map((m) => m[1]));
    for (const n of resources) ctx.check(listedResources.has(n), `README.md: Resources line is missing "${n}"`);
    for (const n of listedResources) ctx.check(resources.includes(n), `README.md: Resources line lists "${n}", which is not in scripts/tools.json`);
  }

  // 12. Text hygiene
  const scannedPaths = new Set();
  for (const [p, f] of repo) {
    if (f.buf.includes(0)) continue; // binary (for example assets/logo.png)
    scannedPaths.add(p);
    const src = f.buf.toString('utf8');
    for (const [re, label] of SECRETS_AND_HOSTS) ctx.check(!re.test(src), `${p}: ${label}`);
    if (!PROSE_EXT.test(p)) continue;
    for (const [re, label] of PROSE_ONLY) ctx.check(!re.test(src), `${p}: ${label}`);
    for (const m of src.matchAll(/(?:github\.com|githubusercontent\.com)\/([A-Za-z0-9-]+)/g)) {
      ctx.check(GITHUB_OWNERS.has(m[1]), `${p}: GitHub link to "${m[1]}" is not an approved owner`);
    }
  }

  // Positive control: the non-prose scan must have covered this script itself.
  ctx.check(!repo.has('scripts/validate.mjs') || scannedPaths.has('scripts/validate.mjs'), 'text hygiene: scripts/validate.mjs was not scanned');

  return { errors, count };
}

// ---------- self-test ----------

function selfTest() {
  const base = loadRepo(ROOT);
  const baseline = new Set(validate(base).errors);
  const clone = () => new Map([...base].map(([k, v]) => [k, { ...v }]));
  const put = (repo, p, s) => repo.set(p, { buf: Buffer.from(s), exec: false });
  const edit = (repo, p, fn) => put(repo, p, fn(text(repo, p)));
  const firstSkill = [...base.keys()].find((p) => /^skills\/[^/]+\/SKILL\.md$/.test(p));
  const skillDir = firstSkill.split('/')[1];

  const fixtures = [
    ['em dash in a skill', /em dash/, (r) => edit(r, firstSkill, (s) => s + '\nA \u2014 B\n')],
    ['bad skill name', /must equal folder/, (r) => edit(r, firstSkill, (s) => s.replace(`name: ${skillDir}`, 'name: corebee-wrong'))],
    ['forbidden tool', /not a live tool/, (r) => edit(r, 'README.md', (s) => s + '\nUse `generate_report`.\n')],
    ['unknown tool', /is not a Corebee tool/, (r) => edit(r, firstSkill, (s) => s + '\nCall `delete_everything_now`.\n')],
    ['differing MCP files', /byte-identical/, (r) => edit(r, '.mcp.json', (s) => s + '\n')],
    ['MCP file with headers', /only the Corebee http server/, (r) => { const s = '{"mcpServers":{"corebee":{"type":"http","url":"https://corebee.ai/api/v1/mcp/stream","headers":{"X-API-Key":"${KEY}"}}}}\n'; put(r, 'mcp.json', s); put(r, '.mcp.json', s); }],
    ['author.url in Cursor manifest', /author\.url/, (r) => edit(r, '.cursor-plugin/plugin.json', (s) => s.replace('"email": "support@corebee.ai"', '"email": "support@corebee.ai", "url": "https://corebee.ai"'))],
    ['grokbot hidden', /hide the Grok Bot listing/, (r) => edit(r, '.cursor-plugin/plugin.json', (s) => s.replace(/"cursor": "(\d+\.\d+\.\d+)"/, '"cursor": "$1", "grokbot": "never"'))],
    ['version drift', /"version" differs/, (r) => edit(r, '.grok-plugin/plugin.json', (s) => s.replace('"version": "1.0.0"', '"version": "1.0.1"'))],
    ['logo in Claude manifest', /fails claude plugin validate/, (r) => edit(r, '.claude-plugin/plugin.json', (s) => s.replace('"license": "MIT",', '"license": "MIT", "logo": "assets/logo.svg",'))],
    ['hooks directory', /hooks\/ directory/, (r) => put(r, 'hooks/hooks.json', '{}')],
    ['executable file', /executable bit/, (r) => { r.set('README.md', { ...r.get('README.md'), exec: true }); }],
    ['removed tool in a skill, outside the forbidden list', /is not a tool or prompt in scripts\/tools\.json/, (r) => edit(r, firstSkill, (s) => s + '\nUse bulk_archive_conversations here.\n')],
    ['marketplace category drift', /plugin category must be/, (r) => edit(r, '.claude-plugin/marketplace.json', (s) => s.replace('"category": "integrations"', '"category": "productivity"'))],
    ['Cursor category drift', /\.cursor-plugin\/plugin\.json: category must be/, (r) => edit(r, '.cursor-plugin/plugin.json', (s) => s.replace('"category": "integrations"', '"category": "productivity"'))],
    ['unlisted tool name outside backticks', /is not a tool or prompt in scripts\/tools\.json/, (r) => edit(r, 'rules/corebee.mdc', (s) => s + '\nThen call list_labels for the IDs.\n')],
    ['non-tool in Tools used', /"Tools used" lists/, (r) => edit(r, firstSkill, (s) => s.replace('## Tools used\n', '## Tools used\n\n- Read: `conversation_id`\n'))],
    ['tool name hidden in known_terms', /looks like a tool name/, (r) => edit(r, 'scripts/tools.json', (s) => s.replace('"known_terms": [', '"known_terms": ["list_labels", '))],
    ['tool counts drift', /"counts" does not match/, (r) => edit(r, 'scripts/tools.json', (s) => s.replace(/"total": \d+/, '"total": 99'))],
    ['symlink', /symlinks are not allowed/, (r) => r.set('hooks-link', { buf: Buffer.alloc(0), exec: false, symlink: true })],
    ['root .lsp.json', /root \.lsp\.json/, (r) => put(r, '.lsp.json', '{}\n')],
    ['Corebee API key in docs', /secret pattern \(Corebee API key\)/, (r) => edit(r, 'README.md', (s) => s + '\nek_' + 'live_' + 'a'.repeat(64) + '\n')],
    ['JWT with typ-first header', /encoded JWT header/, (r) => edit(r, 'PRIVACY.md', (s) => s + '\neyJ0e' + 'XAiOiJKV1QifQ.x.y\n')],
    ['README prompts drift', /Prompts line is missing/, (r) => edit(r, 'README.md', (s) => s.replace(/^(\*\*Prompts:\*\*.*?)`draft_reply`/m, '$1draft reply'))],
    ['README resources drift', /Resources line is missing/, (r) => edit(r, 'README.md', (s) => s.replace('`metrics://dashboard`', 'metrics dashboard'))],
    ['README extra resource', /Resources line lists/, (r) => edit(r, 'README.md', (s) => s.replace('`metrics://dashboard`', '`metrics://dashboard`, `ui://corebee/ticket-triage`'))],
    ['snapshot resources drift', /Resources line lists/, (r) => edit(r, 'scripts/tools.json', (s) => s.replace('"metrics://dashboard",', ''))],
    ['wrong security contact', /not the security contact in SECURITY\.md/, (r) => edit(r, 'SECURITY.md', (s) => s.replace('jonathan@corebee.ai', 'secur' + 'ity@corebee.ai'))],
    ['README table drift', /tools table is missing/, (r) => edit(r, 'README.md', (s) => s.replace(/^\| `get_trends` .*\n/m, ''))],
    ['secret in docs', /secret pattern/, (r) => edit(r, 'SECURITY.md', (s) => s + '\nghp_' + 'A'.repeat(36) + '\n')],
    ['missing safety rules', /Safety rules/, (r) => edit(r, firstSkill, (s) => s.replace('## Safety rules', '## Notes'))],
    ['unpublished docs link', /link target not published \(corebee\.ai\/docs\)/, (r) => edit(r, 'README.md', (s) => s + '\nSee https://corebee.ai/docs.\n')],
    ['personal GitHub link', /not an approved owner/, (r) => edit(r, 'README.md', (s) => s + '\nhttps://github.com/someone-else/repo\n')],
    ['stray loopback host', /loopback host reference/, (r) => edit(r, 'README.md', (s) => s + '\nhttp://local' + 'host:8787/callback\n')],
    ['secret in the validator', /secret pattern \(ghp_\)/, (r) => edit(r, 'scripts/validate.mjs', (s) => s + '\n// ghp_' + 'B'.repeat(36) + '\n')],
    ['secret in the SVG logo', /assets\/logo\.svg: secret pattern/, (r) => edit(r, 'assets/logo.svg', (s) => s + '\n<!-- ghp_' + 'C'.repeat(36) + ' -->\n')],
    ['Fly hostname in the README', /README\.md: internal hostname \(Fly app\)/, (r) => edit(r, 'README.md', (s) => s + '\nhttps://example-app.fly' + '.dev/health\n')],
    ['internal host in a dotfile', /\.gitignore: internal hostname/, (r) => edit(r, '.gitignore', (s) => s + '\n# preview.vercel' + '.app\n')],
    ['unquoted colon in skill description', /value must be quoted/, (r) => edit(r, firstSkill, (s) => s.replace(/^description: .*$/m, 'description: Build a report: volume and trends for the Corebee inbox.'))],
    ['broken double-quoted description', /invalid double-quoted value/, (r) => edit(r, firstSkill, (s) => s.replace(/^description: .*$/m, 'description: "Build a "quoted" report for the Corebee inbox."'))],
    ['bad rule frontmatter', /alwaysApply/, (r) => edit(r, 'rules/corebee.mdc', (s) => s.replace('alwaysApply: false', 'alwaysApply: sometimes'))],
    ['marketplace description drift', /plugin "description" differs/, (r) => edit(r, '.claude-plugin/marketplace.json', (s) => s.replace('"description": "Work', '"description": "Run'))],
    ['skill description over the listing cut', /description must be 20 to 250 characters/, (r) => edit(r, firstSkill, (s) => s.replace(/^description: .*$/m, 'description: "' + 'Triage the Corebee inbox. '.repeat(10) + '"'))],
    ['plugin description over the preview cut', /description must be 1 to 150 characters/, (r) => edit(r, '.cursor-plugin/plugin.json', (s) => s.replace('"description": "Work', '"description": "' + 'Work '.repeat(31)))],
    ['inline hooks in a manifest', /"hooks" is not allowed/, (r) => edit(r, '.cursor-plugin/plugin.json', (s) => s.replace('"license": "MIT",', '"license": "MIT", "hooks": {"SessionStart": []},'))],
    ['hooks file path in the Claude manifest', /\.claude-plugin\/plugin\.json: "hooks" is not allowed/, (r) => edit(r, '.claude-plugin/plugin.json', (s) => s.replace('"license": "MIT",', '"license": "MIT", "hooks": "./x.json",'))],
    ['lspServers in the Grok manifest', /"lspServers" is not allowed/, (r) => edit(r, '.grok-plugin/plugin.json', (s) => s.replace('"license": "MIT",', '"license": "MIT", "lspServers": {},'))],
    ['script inside a skill folder', /other than SKILL\.md/, (r) => put(r, `skills/${skillDir}/scripts/run.sh`, 'echo hi\n')],
    ['Cursor marketplace file', /multi-plugin repos/, (r) => put(r, '.cursor-plugin/marketplace.json', '{}\n')],
    ['unknown tool in a code block', /in a code block is not a Corebee tool/, (r) => edit(r, firstSkill, (s) => s + '\n```text\ncall delete_everything_now\n```\n')],
    ['missing changelog entry', /CHANGELOG\.md/, (r) => edit(r, 'CHANGELOG.md', (s) => s.replace(/^## 1\.0\.0.*$/m, '## Unreleased'))],
  ];

  const failures = [];
  for (const [label, expect, mutate] of fixtures) {
    const repo = clone();
    mutate(repo);
    const fresh = validate(repo).errors.filter((e) => !baseline.has(e));
    if (!fresh.some((e) => expect.test(e))) failures.push(`${label}: not detected (new errors: ${fresh.join('; ') || 'none'})`);
  }
  if (failures.length) {
    console.error('Self-test FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`Self-test OK ${fixtures.length} fixtures detected`);
}

// ---------- live gate (opt-in) ----------

// Compares the snapshot with what the hosted server publishes without
// authentication, plus the security contact and the disclosure redirect that
// SECURITY.md and CONTRIBUTING step 1 depend on. It is the automated half of
// the release checklist; the authenticated half (tools/list, prompts/list,
// resources/list, one two-step delete, one delivered reply) stays manual.
export async function validateLive(repo, fetchImpl = globalThis.fetch) {
  const errors = [];
  let count = 0;
  const check = (cond, msg) => { count++; if (!cond) errors.push(msg); };
  const toolsDoc = parseJson(repo, 'scripts/tools.json') || {};
  const tools = Array.isArray(toolsDoc.tools) ? toolsDoc.tools : [];
  const sameSet = (a, b) => isDeepStrictEqual([...new Set(a)].sort(), [...new Set(b)].sort());

  let card = null;
  try {
    const res = await fetchImpl(LIVE.card, { redirect: 'manual' });
    check(res.status === 200, `live: ${LIVE.card} returned ${res.status}`);
    if (res.status === 200) card = await res.json();
  } catch (e) {
    check(false, `live: ${LIVE.card} could not be fetched (${e.message})`);
  }
  if (card) {
    check(card.tool_discovery === toolsDoc.discovery, `live: server card tool_discovery is "${card.tool_discovery}", snapshot says "${toolsDoc.discovery}"`);
    check(card.tool_count === tools.length, `live: server card tool_count is ${card.tool_count}, snapshot has ${tools.length}`);
    check(card.initial_tool_count === tools.length, `live: server card initial_tool_count is ${card.initial_tool_count}, snapshot has ${tools.length} (a smaller number means progressive discovery is on)`);
    const expectedCategories = tools.map((t) => GROUP_TO_CATEGORY[t.group] || t.group);
    check(sameSet(card.tool_categories || [], expectedCategories), `live: server card tool_categories ${JSON.stringify(card.tool_categories)} differ from the snapshot groups ${JSON.stringify([...new Set(expectedCategories)])}`);
    check(sameSet(card.scopes_supported || [], toolsDoc.scopes || []), `live: server card scopes_supported ${JSON.stringify(card.scopes_supported)} differ from the snapshot scopes`);
    check(card.endpoint === toolsDoc.server, `live: server card endpoint is "${card.endpoint}", snapshot says "${toolsDoc.server}"`);
  }

  try {
    const res = await fetchImpl(LIVE.securityTxt, { redirect: 'manual' });
    check(res.status === 200, `live: ${LIVE.securityTxt} returned ${res.status}`);
    if (res.status === 200) {
      const body = await res.text();
      const contacts = [...body.matchAll(/^Contact:\s*(.+)$/gm)].map((m) => m[1].trim());
      check(contacts.includes(`mailto:${LIVE.securityContact}`), `live: security.txt Contact is ${JSON.stringify(contacts)}, SECURITY.md says ${LIVE.securityContact}`);
      check(contacts.every((c) => !c.includes('secur' + 'ity@corebee.ai')), 'live: security.txt lists a contact that SECURITY.md does not name');
    }
  } catch (e) {
    check(false, `live: ${LIVE.securityTxt} could not be fetched (${e.message})`);
  }

  try {
    const res = await fetchImpl(LIVE.disclosure, { method: 'HEAD', redirect: 'manual' });
    check(res.status === 308, `live: ${LIVE.disclosure} answered ${res.status}, CONTRIBUTING step 1 requires a 308`);
    const loc = res.headers.get('location') || '';
    const target = loc.startsWith('/') ? `https://corebee.ai${loc}` : loc;
    check(target === LIVE.disclosureTarget, `live: ${LIVE.disclosure} Location is "${loc}", expected ${LIVE.disclosureTarget}`);
  } catch (e) {
    check(false, `live: ${LIVE.disclosure} could not be fetched (${e.message})`);
  }

  return { errors, count };
}

// ---------- main ----------

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const repo = loadRepo(ROOT);
  const { errors, count } = validate(repo);
  if (errors.length) {
    console.error(`FAILED ${errors.length} of ${count} checks:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`OK ${count} checks`);
  if (process.argv.includes('--live')) {
    const live = await validateLive(repo);
    if (live.errors.length) {
      console.error(`LIVE FAILED ${live.errors.length} of ${live.count} checks (the hosted server does not match this release yet):`);
      for (const e of live.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(`LIVE OK ${live.count} checks`);
  }
}
