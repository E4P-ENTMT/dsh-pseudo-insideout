import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InsideOutService } from '../src/core/service.js';

function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'insideout-cross-session-'));
  const open = () => new InsideOutService({ dataDir, clock: () => new Date('2026-11-06T04:00:00Z') });
  let service = open();
  t.after(() => { service.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return { get s() { return service; }, dataDir, reopen() { service.close(); return service = open(); } };
}
const capture = (s, turnId, userText, analysis) => s.getMemory(s.completeTurn({ sessionId: 'source', turnId, userText, analysis }).memoryId, { tier: 'active' });
const ids = result => result.items.map(item => item.id);
const analysis = source => ({ confidence: 0.95, evidenceVersions: { [source.id]: source.version }, reason: '基于活跃背景',
  memory: { kind: 'preference', importance: 0.8, tags: ['咖啡'], entities: [], semanticKeys: [], reason: '保留用户陈述' } });
function simulateLegacy(s) {
  const config = s.getConfig(); delete config.captureVisibility;
  s._setting('config', config);
  s.db.prepare('DELETE FROM settings WHERE key=?').run('captureScopeMigration');
}

test('automatic memories are recalled by a fresh session and survive restart with original provenance', t => {
  const f = fixture(t), s = f.s;
  const stored = capture(s, 'first', '我喜欢喝无糖咖啡。');
  assert.equal(stored.visibility, 'workspace');
  assert.equal(stored.source.sessionId, 'source');
  assert.ok(ids(s.searchActive({ sessionId: 'new-session', query: '咖啡' })).includes(stored.id));
  assert.ok(ids(s.analysisContext({ sessionId: 'new-session', query: '咖啡' })).includes(stored.id));
  assert.ok(s.buildContext({ sessionId: 'new-session', turnId: '1', query: '咖啡' }).text.includes(stored.content));
  const reopened = f.reopen();
  reopened._archive = () => { throw new Error('ordinary cross-session recall must not open the archive'); };
  assert.ok(ids(reopened.searchActive({ sessionId: 'after-restart', query: '咖啡' })).includes(stored.id));
  assert.ok(reopened.buildContext({ sessionId: 'after-restart', turnId: '1', query: '咖啡' }).text.includes(stored.id));
  assert.deepEqual(reopened.getMemory(stored.id, { tier: 'active' }), stored);
});

test('private capture preference persists, policy changes reject delayed turns, and disabled targets recall nothing', t => {
  const f = fixture(t), s = f.s;
  const shared = capture(s, 'shared', '自动保存的共享偏好');
  const stamp = s.getSessionMemory({ sessionId: 'source' }).stamp;
  assert.throws(() => s.updateConfig({ captureVisibility: 'all' }), { code: 'INVALID_CONFIG' });
  s.updateConfig({ captureVisibility: 'session' });
  assert.notEqual(s.getSessionMemory({ sessionId: 'source' }).stamp, stamp);
  assert.equal(s.completeTurn({ sessionId: 'source', turnId: 'delayed', userText: '旧策略的迟到输入', policyStamp: stamp }).captured, false);
  const privateMemory = capture(s, 'private', '只属于来源会话的偏好');
  assert.equal(privateMemory.visibility, 'session');
  assert.deepEqual(ids(s.searchActive({ sessionId: 'target' })), [shared.id]);
  s.updateSessionMemory({ sessionId: 'target', expectedVersion: 0, override: 'off' });
  assert.deepEqual(s.searchActive({ sessionId: 'target' }).items, []);
  assert.equal(s.buildContext({ sessionId: 'target', turnId: 'off' }).text, '');
  const reopened = f.reopen();
  assert.equal(reopened.getConfig().captureVisibility, 'session');
  assert.equal(reopened.getMemory(privateMemory.id, { tier: 'active' }).visibility, 'session');
  assert.equal(capture(reopened, 'later-private', '后续私有记录').visibility, 'session');
  reopened.updateConfig({ captureVisibility: 'workspace' });
  assert.equal(reopened.getMemory(privateMemory.id, { tier: 'active' }).visibility, 'session', 'changing the default does not rewrite existing explicit privacy');
});

test('private analysis or emotion evidence cannot leak through shared automatic capture', t => {
  const { s } = fixture(t);
  const privateSource = s.createMemory({ content: 'PRIVATE_BACKGROUND', source: { type: 'user', sessionId: 'source' } });
  const privateCapture = capture(s, 'private-model', '本轮模型提炼', analysis(privateSource));
  assert.equal(privateCapture.visibility, 'session');
  const moodOnly = analysis(privateSource); delete moodOnly.memory; moodOnly.emotions = { joy: 0.5 };
  assert.equal(capture(s, 'private-emotion', '本轮情绪提炼', moodOnly).visibility, 'session');
  assert.deepEqual(s.analysisContext({ sessionId: 'other' }).items, []);
  const sharedSource = capture(s, 'public-source', '我喜欢咖啡');
  const sharedCapture = capture(s, 'public-model', '我每天喝一杯咖啡', analysis(sharedSource));
  assert.equal(sharedCapture.visibility, 'workspace');
  assert.ok(ids(s.analysisContext({ sessionId: 'other' })).includes(sharedCapture.id));
  s.archiveMemory(sharedSource.id, { expectedVersion: sharedSource.version });
  assert.ok(!ids(s.searchActive({ sessionId: 'other' })).includes(sharedSource.id));
  assert.equal(s.getMemory(sharedCapture.id, { tier: 'active' }).extraction.method, 'local-rules-after-invalidation');
});

test('legacy migration shares only unedited automatic active records and preserves private, imported and archived data', t => {
  const f = fixture(t), s = f.s;
  s.updateConfig({ captureVisibility: 'session' });
  const source = capture(s, 'legacy-source', '我喜欢无糖咖啡');
  const modeled = capture(s, 'legacy-model', '我每天喝无糖咖啡', analysis(source));
  const manual = s.createMemory({ content: '手动私有资料', source: { type: 'user', sessionId: 'source' } });
  const privateModel = capture(s, 'private-source', '依赖私有资料的提炼', analysis(manual));
  let interpreted = capture(s, 'interpreted', '手动解释过的旧记录');
  interpreted = s.addInterpretation(interpreted.id, { expectedVersion: interpreted.version, text: '用户新增的私有解释', evidenceIds: [] });
  let edited = capture(s, 'edited', '手动保留私有的记录');
  edited = s.updateMemory(edited.id, { expectedVersion: edited.version, visibility: 'session', reason: '明确保留私有' });
  const archived = capture(s, 'archived', '封存的旧记录');
  s.archiveMemory(archived.id, { expectedVersion: archived.version });
  const trashed = capture(s, 'trashed', '回收箱里的旧记录');
  s.trashMemory(trashed.id, { expectedVersion: trashed.version });
  const file = s.previewImport({ source: 'file', targetSessionId: 'source', file: { name: 'private.txt', format: 'txt', content: '私有导入记录' } });
  const imported = s.commitImport({ previewId: file.previewId, recordIds: file.items.map(item => item.id) }).imported[0];
  const summary = s.createMemory({ content: '咖啡习惯总结', source: { type: 'model', sessionId: 'source' }, sourceIds: [source.id, modeled.id], kind: 'reflection' });
  const coldBefore = readFileSync(s.archivePath);
  // Old releases only have turn.captured logs, without capture dedup entries.
  s.db.prepare("DELETE FROM dedup WHERE key LIKE 'capture:%'").run();
  simulateLegacy(s);
  const migrated = f.reopen();
  assert.equal(migrated.getConfig().captureVisibility, 'workspace');
  assert.deepEqual(new Set(ids(migrated.searchActive({ sessionId: 'new' }))), new Set([source.id, modeled.id]));
  for (const before of [source, modeled]) {
    const after = migrated.getMemory(before.id, { tier: 'active' });
    assert.equal(after.visibility, 'workspace'); assert.equal(after.version, before.version + 1);
    for (const key of ['source', 'original', 'content', 'eventAt', 'createdAt', 'extraction']) assert.deepEqual(after[key], before[key]);
    assert.equal(after.revisions.at(-1).author, 'system');
  }
  for (const memory of [manual, edited, interpreted, privateModel, imported, summary]) assert.equal(migrated.getMemory(memory.id, { tier: 'active' }).visibility, 'session');
  assert.deepEqual(readFileSync(migrated.archivePath), coldBefore, 'startup must not touch archived originals or indexes');
  assert.equal(migrated.getMemory(modeled.id, { tier: 'active' }).analysisEvidenceVersions[source.id], source.version + 1);
  const logs = migrated.listLogs().items.filter(item => item.action === 'memory.capture-scope-migrated');
  assert.equal(logs.length, 1); assert.equal(logs[0].details.count, 2);
  const archivedSummary = migrated.archiveMemory(summary.id, { expectedVersion: summary.version }).memory;
  assert.doesNotThrow(() => migrated.restoreMemory(summary.id, { expectedVersion: archivedSummary.version }), 'still-valid active proofs survive migration without retiring derived knowledge');
  migrated.updateMemory(source.id, { expectedVersion: source.version + 1, visibility: 'session', reason: '升级后单独收紧范围' });
  const again = f.reopen();
  assert.equal(again.getMemory(source.id, { tier: 'active' }).visibility, 'session', 'one-time migration never undoes a later privacy edit');
  assert.equal(again.listLogs().items.filter(item => item.action === 'memory.capture-scope-migrated').length, 1);
});

test('legacy migration retains stale evidence and skips an explicitly configured capture scope', t => {
  const f = fixture(t), s = f.s;
  s.updateConfig({ captureVisibility: 'session' });
  const source = capture(s, 'basis', '旧自动记忆');
  const summary = s.createMemory({ content: '过时的旧总结', source: { type: 'model', sessionId: 'source' }, sourceIds: [source.id] });
  summary.evidenceHashes[source.id] = 'stale-proof'; s._save(summary);
  simulateLegacy(s);
  const migrated = f.reopen();
  const archived = migrated.archiveMemory(summary.id, { expectedVersion: summary.version }).memory;
  assert.throws(() => migrated.restoreMemory(summary.id, { expectedVersion: archived.version }), { code: 'STALE_EVIDENCE' });
  migrated.updateConfig({ captureVisibility: 'session' });
  const explicit = capture(migrated, 'explicit', '明确选择私有的自动记忆');
  migrated.db.prepare('DELETE FROM settings WHERE key=?').run('captureScopeMigration');
  assert.equal(f.reopen().getMemory(explicit.id, { tier: 'active' }).visibility, 'session');
});

test('legacy migration preserves approved islands and still-current proposals to extend them', t => {
  const f = fixture(t), s = f.s;
  s.updateConfig({ captureVisibility: 'session' });
  for (let index = 0; index < 3; index++) {
    s.clock = () => new Date(`2026-11-0${index + 1}T04:00:00Z`);
    capture(s, `coffee-${index}`, ['我喜欢喝无糖咖啡。', '我每天喝一杯咖啡。', '我偏爱不加糖的咖啡。'][index]);
  }
  const initial = s.runDream().items.find(item => item.type === 'island' && item.payload.title === '咖啡');
  assert.ok(initial);
  s.decideDream(initial.id, { expectedVersion: initial.version, action: 'approve' });
  const island = s.listIslands().items[0];
  s.clock = () => new Date('2026-11-04T04:00:00Z');
  capture(s, 'coffee-4', '我最喜欢的饮品是咖啡。');
  const extension = s.runDream().items.find(item => item.type === 'island' && item.payload.islandId === island.id);
  assert.ok(extension);
  simulateLegacy(s);
  const migrated = f.reopen(), current = migrated.listIslands().items.find(item => item.id === island.id);
  assert.equal(current.enabled, true); assert.equal(current.description, island.description);
  const pending = migrated.listDreams().items.find(item => item.id === extension.id);
  assert.equal(pending.payload.islandVersion, current.version);
  assert.doesNotThrow(() => migrated.decideDream(pending.id, { expectedVersion: pending.version, action: 'approve' }));
});

test('legacy migration rolls back records, policy and marker together on a failed write', t => {
  const f = fixture(t), s = f.s;
  s.updateConfig({ captureVisibility: 'session' });
  const before = [capture(s, 'atomic-1', '第一条旧记忆'), capture(s, 'atomic-2', '第二条旧记忆')];
  simulateLegacy(s);
  const save = InsideOutService.prototype._save;
  let writes = 0;
  try {
    InsideOutService.prototype._save = function(memory) { save.call(this, memory); if (++writes === 2) throw new Error('injected migration failure'); };
    assert.throws(() => new InsideOutService({ dataDir: f.dataDir }), /injected migration failure/);
  } finally { InsideOutService.prototype._save = save; }
  for (const memory of before) assert.deepEqual(s.getMemory(memory.id, { tier: 'active' }), memory);
  assert.equal(s._setting('captureScopeMigration'), null);
  assert.equal(s._setting('config').captureVisibility, undefined);
  assert.ok(!s.listLogs().items.some(item => item.action === 'memory.capture-scope-migrated'));
  const retry = f.reopen();
  assert.deepEqual(new Set(ids(retry.searchActive({ sessionId: 'after-retry' }))), new Set(before.map(memory => memory.id)));
});
