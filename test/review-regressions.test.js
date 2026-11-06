import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { InsideOutService } from '../src/core/service.js';
import { analyzeLocalTurn } from '../src/core/intelligence.js';

function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'insideout-regression-'));
  const service = new InsideOutService({ dataDir, clock: () => new Date('2026-11-05T04:00:00Z') });
  t.after(() => { service.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return { service, dataDir };
}
const input = (content, extra = {}) => ({ content, source: { type: 'user', sessionId: 's' }, ...extra });

test('real statements with conditional follow-ups and code remain recallable; explicit fiction stays excluded', t => {
  const { service: s } = fixture(t);
  for (const [i, text] of [
    '我住在上海。如果以后推荐活动，请优先考虑上海。',
    'I live in Shanghai. If you suggest events, prefer Shanghai.',
    '我今天写了 if (ready) run() 这段代码。',
    '```js\nif (ready) run();\n```\n我在上海完成了代码审查。',
  ].entries()) {
    assert.equal(analyzeLocalTurn(text).fictional, false, text);
    s.completeTurn({ sessionId: 's', turnId: String(i), userText: text });
  }
  assert.equal(s.searchActive({ sessionId: 's', query: '' }).total, 4);
  const mixed = analyzeLocalTurn('我住在上海。如果我喜欢咖啡，就会经常去咖啡馆。');
  assert.equal(mixed.fictional, false); assert.equal(mixed.kind, 'episode'); assert.equal(mixed.profileFacet, null);
  for (const text of ['如果我住在火星，我会每天看星星。', 'If I liked coffee, I would drink it.', '假如我是飞行员。', '请扮演一位虚构的医生。']) {
    assert.equal(analyzeLocalTurn(text).fictional, true, text);
  }
});

test('fiction classification can be corrected with optimistic concurrency and an auditable revision', t => {
  const { service: s } = fixture(t);
  const m = s.createMemory(input('我住在上海。如果需要推荐活动，请考虑上海。', { fictional: true }));
  assert.equal(s.searchActive({ sessionId: 's', query: '上海' }).total, 0);
  const fixed = s.updateMemory(m.id, { expectedVersion: m.version, fictional: false, reason: '条件表达不是虚构，核对原话后更正' });
  assert.equal(fixed.original, m.original);
  assert.equal(fixed.revisions.at(-1).fictional, true);
  assert.equal(s.searchActive({ sessionId: 's', query: '上海' }).items[0].id, m.id);
  assert.throws(() => s.updateMemory(m.id, { expectedVersion: m.version, fictional: true }), { code: 'VERSION_CONFLICT' });
  assert.throws(() => s.updateMemory(m.id, { expectedVersion: fixed.version, fictional: 'false' }), { code: 'INVALID_INPUT' });
  const fictional = s.updateMemory(m.id, { expectedVersion: fixed.version, fictional: true, reason: '重新分类' });
  assert.equal(fictional.revisions.at(-1).fictional, false);
  assert.equal(s.buildContext({ sessionId: 's', turnId: 'again', query: '上海' }).items.length, 0);
});

test('structurally corrupt JSON is isolated without changing bytes or breaking healthy recall', t => {
  const { service: s } = fixture(t);
  const good = s.createMemory(input('完整正常记录 上海'));
  const mutations = [
    m => { delete m.entities; }, m => { m.source = {}; }, m => { m.emotions = null; },
    m => { m.sourceIds = [null]; }, m => { m.interpretations = [{ text: '解释', evidenceIds: {} }]; },
    m => { m.revisions = null; }, m => { m.eventAt = 42; }, m => { m.version = '1'; },
    m => { m.tags = [1]; }, m => { m.semanticKeys = {}; }, m => { m.analysisEvidenceIds = [false]; },
    m => { m.fictional = 'false'; }, m => { m.tier = 'archive'; },
  ];
  const corrupted = mutations.map((mutate, i) => {
    const m = s.createMemory(input(`损坏记录 ${i} 上海`)); mutate(m);
    const bytes = JSON.stringify(m); s.db.prepare('UPDATE memories SET data=? WHERE id=?').run(bytes, m.id);
    return { id: m.id, bytes };
  });
  for (let round = 0; round < 2; round++) {
    assert.deepEqual(s.searchActive({ sessionId: 's', query: '上海' }).items.map(m => m.id), [good.id]);
    assert.deepEqual(s.buildContext({ sessionId: 's', turnId: `valid-${round}`, query: '上海' }).items.map(m => m.id), [good.id]);
    assert.equal(s.state().storage.issues[0].ids.length, corrupted.length);
  }
  for (const m of corrupted) {
    assert.equal(s.db.prepare('SELECT data FROM memories WHERE id=?').get(m.id).data, m.bytes);
    assert.throws(() => s.getMemory(m.id, { tier: 'active' }), { code: 'CORRUPT_RECORD' });
  }
});

test('reused search features respect external edits, classification, visibility, archive and deletion', t => {
  const { service: s, dataDir } = fixture(t);
  const m = s.createMemory(input('I enjoy kittens.', { title: '经历', importance: 0.1 }));
  const search = query => s.searchActive({ sessionId: 's', query }).items.map(m => m.id);
  assert.deepEqual(search('小猫'), [m.id]); assert.deepEqual(search('小猫'), [m.id]);
  const other = new DatabaseSync(join(dataDir, 'active', 'insideout.sqlite'));
  const external = { ...m, content: '今天维修了自行车' };
  other.prepare('UPDATE memories SET data=? WHERE id=?').run(JSON.stringify(external), m.id); other.close();
  assert.deepEqual(search('小猫'), []);
  assert.deepEqual(search('自行车'), [m.id]);
  s.db.prepare('UPDATE memories SET data=? WHERE id=?').run(JSON.stringify({ ...external, fictional: true }), m.id);
  assert.deepEqual(search('自行车'), []);
  s.db.prepare('UPDATE memories SET data=? WHERE id=?').run(JSON.stringify(external), m.id);
  assert.deepEqual(search('自行车'), [m.id]);
  assert.equal(s.searchActive({ sessionId: 'private', query: '自行车' }).total, 0);
  const archive = s.archiveMemory(m.id, { expectedVersion: m.version, reason: '检索隔离测试' }).memory;
  assert.deepEqual(search('自行车'), []);
  const restored = s.restoreMemory(m.id, { expectedVersion: archive.version });
  assert.deepEqual(search('自行车'), [m.id]);
  s.deleteMemory(m.id, { expectedVersion: restored.version, confirmation: m.id });
  assert.deepEqual(search('自行车'), []);
});

test('model switch preserves memory policy and local capture and rejects supplied model analysis', t => {
  const { service: s } = fixture(t);
  const stamp = s.getSessionMemory({ sessionId: 's' }).stamp;
  s.updateConfig({ modelEnabled: false });
  assert.equal(s.getSessionMemory({ sessionId: 's' }).stamp, stamp);
  s.completeTurn({ sessionId: 's', turnId: '1', userText: '我喜欢小猫。', policyStamp: stamp,
    analysis: { confidence: 1, memory: { kind: 'fact', importance: 1, tags: ['MODEL_ONLY'], entities: [], fictional: false } } });
  const memory = s.listMemories().items[0];
  assert.equal(memory.extraction.method, 'local-rules'); assert.ok(!memory.tags.includes('MODEL_ONLY'));
  assert.equal(s.searchActive({ sessionId: 's', query: 'kittens' }).items[0].id, memory.id);
});

test('legacy search indexes rebuild on first use and derived features remain separate from archived data', t => {
  const { service: s, dataDir } = fixture(t);
  const m = s.createMemory(input('我喜欢小猫。'));
  s.db.exec("DELETE FROM search; DELETE FROM search_features; DELETE FROM settings WHERE key='searchIndexFormat'");
  let reopened = new InsideOutService({ dataDir });
  try {
    assert.equal(reopened.searchActive({ sessionId: 's', query: 'kittens' }).items[0].id, m.id);
    assert.equal(reopened.archiveAttached, false);
    reopened.close(); reopened = new InsideOutService({ dataDir });
    assert.equal(reopened.searchActive({ sessionId: 's', query: 'kittens' }).items[0].id, m.id);
    reopened.archiveMemory(m.id, { expectedVersion: m.version, reason: '派生索引也须移出活跃库' });
    assert.equal(reopened.searchActive({ sessionId: 's', query: 'kittens' }).total, 0);
    assert.equal(reopened.db.prepare('SELECT count(*) n FROM search_features WHERE id=?').get(m.id).n, 0);
    assert.equal(reopened.db.prepare('SELECT count(*) n FROM search WHERE id=?').get(m.id).n, 0);
  } finally { reopened.close(); }
});
