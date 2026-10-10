import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Research snapshot: factual characteristics and identifiers, not a rules-text mirror.
const commit = 'cc58ee3b2c23f90af9d00e7bf234cd703b762299';
const repo = 'BSData/wh40k-11e';
const out = fileURLToPath(new URL('../research/data/', import.meta.url));
const headers = { 'User-Agent': 'KS-research', Accept: 'application/vnd.github+json' };
async function get(url) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return res.text();
}
const tree = JSON.parse(await get(`https://api.github.com/repos/${repo}/git/trees/${commit}`));
if (tree.truncated) throw new Error('Truncated source tree');
const files = tree.tree.filter(f => f.type === 'blob' && f.path.endsWith('.json'));
await mkdir(out, { recursive: true });
const allowed = new Set(['M', 'T', 'SV', 'W', 'LD', 'OC', 'Range', 'A', 'BS', 'WS', 'S', 'AP', 'D']);
const inventory = [];
let cursor = 0;
async function worker() {
  while (cursor < files.length) {
    const f = files[cursor++];
    const sourceUrl = `https://raw.githubusercontent.com/${repo}/${commit}/${encodeURIComponent(f.path)}`;
    const raw = await get(sourceUrl);
    const parsed = JSON.parse(raw);
    const root = parsed.catalogue ?? parsed.gameSystem;
    if (!root?.id) throw new Error(`Missing root in ${f.path}`);
    const profiles = [], entries = [], references = [];
    function walk(node, ancestry = []) {
      if (Array.isArray(node)) { for (const value of node) walk(value, ancestry); return; }
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node.characteristics)) {
        const stats = Object.fromEntries(node.characteristics.filter(c => allowed.has(c.name)).map(c => [c.name, c.$text ?? c.value ?? null]));
        if (Object.keys(stats).length) profiles.push({ id: node.id, name: node.name, type: node.typeName, ancestry, stats });
      }
      if (['unit', 'model'].includes(node.type) && node.id) {
        entries.push({ id: node.id, name: node.name, type: node.type, hidden: node.hidden ?? false, ancestry,
          costs: (node.costs ?? []).map(c => ({ name: c.name, typeId: c.typeId, value: c.value })),
          profileLinks: (node.infoLinks ?? []).map(l => ({ id: l.id, targetId: l.targetId, type: l.type })) });
      }
      if (node.targetId) references.push({ id: node.id, targetId: node.targetId, type: node.type, name: node.name });
      const path = node.id ? [...ancestry, node.id] : ancestry;
      for (const [key, value] of Object.entries(node)) {
        if (['characteristics', 'description', '$text', 'readme', 'comment'].includes(key)) continue;
        if (value && typeof value === 'object') walk(value, path);
      }
    }
    walk(root);
    const result = { source: { repo, commit, file: f.path, sourceUrl, sha256: createHash('sha256').update(raw).digest('hex') },
      catalogue: { id: root.id, name: root.name, revision: root.revision, library: root.library ?? false,
        imports: (root.catalogueLinks ?? []).map(l => ({ name: l.name, targetId: l.targetId, importRootEntries: l.importRootEntries })) },
      status: 'research-only-unresolved-conditional-values', profiles, entries, references };
    await writeFile(`${out}${f.path}`, JSON.stringify(result, null, 2) + '\n');
    inventory.push({ file: f.path, sourceUrl, catalogueId: root.id, name: root.name, library: root.library ?? false,
      revision: root.revision, numericProfileCount: profiles.length, unitOrModelEntryCount: entries.length, sha256: result.source.sha256 });
    console.log(`${f.path}: ${profiles.length} profiles, ${entries.length} entries`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
inventory.sort((a,b) => a.file.localeCompare(b.file));
await writeFile(`${out}manifest.json`, JSON.stringify({ checkedOn: '2026-10-10', repo, commit,
  officialPointsIndexUpdate: '2026-09-30', officialPointsVerified: false,
  caveats: ['Community snapshot; not authoritative or guaranteed complete.', 'Entries and profiles are unresolved: imports, modifiers and roster constraints need an evaluator.', 'Abilities and other prose rules are omitted.', 'Numeric profile counts are not unique datasheet counts.', 'Base sizes and model silhouettes require a separately verified geometry dataset.'],
  files: inventory }, null, 2) + '\n');
console.log(JSON.stringify({ files: inventory.length, profiles: inventory.reduce((n,x)=>n+x.numericProfileCount,0), entries: inventory.reduce((n,x)=>n+x.unitOrModelEntryCount,0) }));
