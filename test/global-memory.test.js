import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InsideOutService } from '../src/core/service.js';
import { MemoryDefaults } from '../src/core/policy.js';
import { GlobalMemoryRegistry } from '../src/core/global-memory.js';
import { handleApi } from '../src/http/api.js';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'insideout-global-')), services = new Set(), stores = new Set();
  const profile = name => {
    const defaults = new MemoryDefaults({ dataDir: join(root, name) }); stores.add(defaults);
    const globalMemory = new GlobalMemoryRegistry(defaults);
    return { defaults, globalMemory, open(scope, external = false) {
      const service = new InsideOutService({ dataDir: join(root, name, scope), defaults, ...(external ? {} : { globalMemory }), runtime: { mode: 'dsh', scopeId: scope, workspaceId: `/work/${scope}`, agentId: `agent-${scope}` } });
      services.add(service); return service;
    } };
  };
  t.after(() => { for (const s of services) s.close(); for (const store of stores) store.close(); rmSync(root, { recursive: true, force: true }); });
  return { root, profile, close(service) { service.close(); services.delete(service); } };
}
const capture = (s, text = 'GLOBAL_MEMORY_MARKER_1106 我喜欢无糖咖啡') => s.getMemory(s.completeTurn({ sessionId: 'source-session', turnId: text, userText: text }).memoryId, { tier: 'active' });
const sharing = (s, enabled) => s.updateMemorySharing({ expectedVersion: s.getMemorySharing().version, enabled });
const search = (s, query = 'GLOBAL_MEMORY_MARKER_1106') => s.searchActive({ sessionId: 'target', query });
const context = (s, turnId = '1') => s.buildContext({ sessionId: 'target', turnId, query: 'GLOBAL_MEMORY_MARKER_1106' });

test('global recall defaults off, federates active shared records on, and writes no foreign bodies or indexes', t => {
  const h = fixture(t), p = h.profile('profile'), a = p.open('a'), b = p.open('b'), source = capture(a);
  const all = a._all; a._all = () => { throw new Error('off must not read another space'); };
  assert.equal(b.getMemorySharing().enabled, false); assert.deepEqual(search(b).items, []); context(b);
  a._all = all;
  sharing(b, true);
  for (const s of [a, b]) s._archive = () => { throw new Error('global recall cannot read the archive'); };
  const found = search(b).items;
  assert.equal(found.length, 1); assert.equal(found[0].globalOrigin.memoryId, source.id);
  assert.equal(found[0].globalOrigin.scopeId, 'a'); assert.equal(found[0].id, `global:a:${source.id}`);
  assert.equal(b.getRecallMemory(found[0].id, { sessionId: 'target' }).version, source.version);
  assert.ok(context(b).text.includes(source.content));
  assert.ok(b.analysisContext({ sessionId: 'target' }).items.some(m => m.id === found[0].id));
  assert.deepEqual(b.analysisContext({ sessionId: 'target', includeGlobal: false }).items, []);
  assert.equal(b.listMemories().total, 0);
  assert.equal(b.db.prepare('SELECT count(*) AS n FROM search_features').get().n, 0);
  assert.equal(readFileSync(join(b.dataDir, 'active/insideout.sqlite')).includes(Buffer.from('GLOBAL_MEMORY_MARKER_1106')), false);
  const result = context(b, 'budget'); assert.ok(result.usedChars <= result.limitChars);
});

test('global switch is versioned, persistent, profile-scoped and invalidates explicit-on sessions and delayed capture', t => {
  const h = fixture(t), p = h.profile('one'), a = p.open('a'), b = p.open('b'), foreign = h.profile('two').open('c');
  capture(a); sharing(a, true);
  assert.equal(b.getMemorySharing().enabled, true); assert.equal(foreign.getMemorySharing().enabled, false);
  b.updateSessionMemory({ sessionId: 'target', expectedVersion: 0, override: 'on' });
  const stamp = b.getSessionMemory({ sessionId: 'target' }).stamp;
  assert.ok(context(b).text.includes('GLOBAL_MEMORY_MARKER_1106'));
  const old = a.getMemorySharing(); sharing(a, false);
  assert.throws(() => b.updateMemorySharing({ expectedVersion: old.version, enabled: true }), { code: 'VERSION_CONFLICT' });
  assert.equal(b.peekContext({ sessionId: 'target', turnId: '1' }), null);
  assert.deepEqual(search(b).items, []);
  assert.equal(b.completeTurn({ sessionId: 'target', turnId: 'late', userText: 'Late analysis must not be captured', policyStamp: stamp }).captured, false);
  sharing(a, true);
  h.close(a); h.close(b);
  const reopenedProfile = h.profile('one'), reopened = reopenedProfile.open('b'); reopenedProfile.open('a');
  assert.equal(reopened.getMemorySharing().enabled, true); assert.equal(search(reopened).items.length, 1);
  assert.deepEqual(search(foreign).items, []);
  assert.throws(() => reopenedProfile.globalMemory.register(foreign), /same profile/);
});

test('source edits, archive, privacy changes and external writes immediately invalidate foreign cached context', t => {
  const h = fixture(t), p = h.profile('profile'), a = p.open('a'), b = p.open('b');
  let source = capture(a); sharing(b, true);
  const reference = search(b).items[0].id;
  context(b);
  a.buildContext({ sessionId: 'source-session', turnId: 'own-read', query: '咖啡' });
  assert.ok(b.peekContext({ sessionId: 'target', turnId: '1' })?.text.includes(source.content), 'ordinary source recall/index/log writes do not invalidate another turn');
  source = a.updateMemory(source.id, { expectedVersion: source.version, title: '已修订', content: '修订后内容 UPDATED_GLOBAL_1106', reason: '更正' });
  assert.equal(b.peekContext({ sessionId: 'target', turnId: '1' }), null);
  assert.equal(b.getRecallMemory(reference, { sessionId: 'target' }).version, source.version);
  assert.ok(!context(b).text.includes('GLOBAL_MEMORY_MARKER_1106'));
  const external = p.open('a', true);
  external.archiveMemory(source.id, { expectedVersion: source.version });
  assert.equal(b.peekContext({ sessionId: 'target', turnId: '1' }), null);
  assert.equal(b.getRecallMemory(reference, { sessionId: 'target' }), null);
  assert.deepEqual(search(b, 'UPDATED_GLOBAL_1106').items, []);
  source = external.getMemory(source.id, { tier: 'archive' });
  source = external.restoreMemory(source.id, { expectedVersion: source.version });
  assert.equal(search(b, 'UPDATED_GLOBAL_1106').items.length, 1);
  context(b);
  source = external.updateMemory(source.id, { expectedVersion: source.version, visibility: 'session' });
  assert.equal(b.peekContext({ sessionId: 'target', turnId: '1' }), null);
  assert.equal(b.getRecallMemory(reference, { sessionId: 'target' }), null);
});

test('global sharing excludes private/imported/fictional/cold data and private evidence closures', t => {
  const h = fixture(t), p = h.profile('profile'), a = p.open('a'), b = p.open('b');
  const shared = capture(a);
  const privateMemory = a.createMemory({ content: 'PRIVATE_NEVER_GLOBAL', source: { type: 'user', sessionId: 'source-session' } });
  const malformed = a.createMemory({ content: 'DERIVED_PRIVATE_NEVER_GLOBAL', source: { type: 'model', sessionId: 'source-session' }, sourceIds: [privateMemory.id] });
  malformed.visibility = 'workspace'; a._save(malformed);
  a.createMemory({ content: 'FICTION_NEVER_GLOBAL', visibility: 'workspace', fictional: true });
  const cold = a.createMemory({ content: 'ARCHIVED_NEVER_GLOBAL', visibility: 'workspace' }); a.archiveMemory(cold.id, { expectedVersion: cold.version });
  const file = a.previewImport({ source: 'file', targetSessionId: 'source-session', file: { name: 'private.txt', format: 'txt', content: 'IMPORTED_NEVER_GLOBAL' } });
  a.commitImport({ previewId: file.previewId, recordIds: file.items.map(item => item.id) });
  sharing(b, true);
  assert.deepEqual(b.searchActive({ sessionId: 'target' }).items.map(item => item.globalOrigin.memoryId), [shared.id]);
  assert.ok(!context(b).text.includes('NEVER_GLOBAL'));
  a.updateSessionMemory({ sessionId: 'source-session', expectedVersion: 0, override: 'off' });
  assert.deepEqual(search(b).items, []);
  a.updateSessionMemory({ sessionId: 'source-session', expectedVersion: 1, override: 'on' });
  a.updateConfig({ enabled: false }); assert.deepEqual(search(b).items, []);
  a.updateConfig({ enabled: true }); assert.equal(search(b).items.length, 1);
  b.updateSessionMemory({ sessionId: 'target', expectedVersion: 0, override: 'off' });
  assert.deepEqual(search(b).items, []); assert.equal(context(b).text, '');
});

test('foreign identity, islands and work state are not shared; colliding record IDs remain scope-qualified', t => {
  const h = fixture(t), p = h.profile('profile'), a = p.open('a'), b = p.open('b'), c = p.open('c');
  const source = capture(a);
  a.updateConfig({ identity: 'PRIVATE_AGENT_IDENTITY', persona: 'PRIVATE_AGENT_PERSONA' });
  a.updateWorkspace({ sessionId: 'source-session', expectedVersion: 0, focus: ['PRIVATE_WORK_FOCUS'] });
  const duplicate = { ...source, content: 'GLOBAL_MEMORY_MARKER_1106 第二个空间同ID', original: '第二份原文' }; c._save(duplicate);
  sharing(b, true);
  const found = search(b).items;
  assert.equal(found.length, 2); assert.equal(new Set(found.map(m => m.id)).size, 2);
  assert.deepEqual(new Set(found.map(m => m.globalOrigin.scopeId)), new Set(['a', 'c']));
  assert.equal(b.getRecallMemory(`global:unknown:${source.id}`, { sessionId: 'target' }), null);
  assert.ok(!context(b).text.includes('PRIVATE_'));
  h.close(c);
  assert.equal(b.peekContext({ sessionId: 'target', turnId: '1' }), null);
  assert.equal(search(b).items.length, 1);
});

test('sharing API is independent of memory defaults, rejects invalid updates and persists standalone settings', t => {
  const h = fixture(t), p = h.profile('profile'), a = p.open('a');
  const defaults = a.getMemoryDefault();
  assert.equal(handleApi(a, { path: '/memory-sharing' }).body.enabled, false);
  assert.equal(handleApi(a, { method: 'PATCH', path: '/memory-sharing', body: { expectedVersion: 0, enabled: 'yes' } }).status, 400);
  assert.equal(handleApi(a, { method: 'PATCH', path: '/memory-sharing', body: { expectedVersion: 0, enabled: true } }).body.enabled, true);
  assert.deepEqual(a.getMemoryDefault(), defaults);
  const external = new MemoryDefaults({ dataDir: join(h.root, 'profile') });
  try { external.updateSharing({ expectedVersion: 1, enabled: false }); assert.equal(a.getMemorySharing().enabled, false); } finally { external.close(); }
  const standaloneRoot = join(h.root, 'standalone');
  let standalone = new InsideOutService({ dataDir: standaloneRoot });
  sharing(standalone, true); standalone.close();
  standalone = new InsideOutService({ dataDir: standaloneRoot });
  try { assert.equal(standalone.getMemorySharing().enabled, true); assert.equal(standalone.getMemorySharing().scope, 'standalone'); } finally { standalone.close(); }
});
