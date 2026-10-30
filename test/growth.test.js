import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InsideOutService } from '../src/core/service.js';
import { handleApi } from '../src/http/api.js';

function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'insideout-growth-'));
  let now = Date.parse('2026-10-28T04:00:00Z');
  const s = new InsideOutService({ dataDir, clock: () => new Date(now) });
  t.after(() => { s.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return { s, advance(ms) { now += ms; }, at(value) { now = Date.parse(value); } };
}
const input = (content, extra = {}) => ({ content, source: { type: 'user', sessionId: 'a' }, ...extra });
const approve = (s, proposal) => s.decideDream(proposal.id, { expectedVersion: proposal.version, action: 'approve' });
function conversations(f) {
  for (const [index, userText] of ['我喜欢喝无糖拿铁。', '我每天早上会喝一杯不加糖的咖啡。', '我还是偏爱咖啡，尤其是不加糖的浓缩咖啡。'].entries()) {
    f.s.completeTurn({ sessionId: 'a', turnId: String(index), userText });
    f.advance(86400000);
  }
}

test('ordinary conversations create structured memories and evidence-based growth without hand-entered metadata', t => {
  const f = fixture(t); conversations(f);
  const memories = f.s.listMemories().items;
  assert.equal(memories.length, 3);
  assert.ok(memories.every(v => v.tags.includes('咖啡') && v.importance > 0.5));
  assert.ok(memories.some(v => v.profileFacet === 'habit'));
  const proposals = f.s.runDream().items;
  const island = proposals.find(v => v.type === 'island' && v.payload.title === '咖啡');
  assert.ok(island); assert.equal(island.evidenceIds.length, 3);
  assert.ok(proposals.some(v => v.type === 'core'));
  const summary = proposals.find(v => v.type === 'summary');
  assert.ok(summary.payload.content.includes(memories[0].id));
  assert.ok(summary.payload.content.includes(memories[1].id));
  assert.equal(f.s.listIslands().items.length, 0);
  approve(f.s, island);
  assert.equal(f.s.listGrowth().items.length, 1);
  assert.ok(f.s.buildContext({ sessionId: 'a', turnId: 'growth', query: '喝什么' }).text.includes('已批准的倾向'));
  const core = f.s.listDreams().items.find(v => v.type === 'core' && v.status === 'pending');
  approve(f.s, core);
  assert.equal(f.s.listIslands().items[0].enabled, true, 'core metadata does not disable valid personality evidence');
});

test('semantic hits, concept expansion and date/entity filters cannot cross scope or archive', t => {
  const { s } = fixture(t);
  const own = s.createMemory(input('我喜欢骑自行车。', { eventAt: '2026-10-27T10:00:00Z', entities: ['小林'] }));
  const other = s.createMemory(input('另一会话的秘密出行', { source: { type: 'user', sessionId: 'b' } }));
  const archived = s.createMemory(input('封存专用出行')); s.archiveMemory(archived.id, { expectedVersion: 1 });
  const context = s.buildContext({ sessionId: 'a', turnId: 'semantic', query: 'pedaling outdoors', semanticHits: [{ id: own.id, score: 0.95 }, { id: other.id, score: 1 }, { id: archived.id, score: 1 }] });
  assert.deepEqual(context.items.map(v => v.id), [own.id]);
  assert.equal(s.searchActive({ sessionId: 'a', query: 'cycling' }).items[0].id, own.id);
  assert.equal(s.searchActive({ sessionId: 'a', query: '', from: '2026-10-28', entity: '小林' }).items.length, 0);
  assert.equal(s.listMemories({ from: '2026-10-27', to: '2026-10-28', entity: '小林' }).items[0].id, own.id);
});

test('model extraction is bounded and model proposals reject stale or cross-session evidence', t => {
  const { s } = fixture(t); s.updateConfig({ dreamEnabled: true });
  const existing = s.createMemory(input('原有经历'));
  const outsider = s.createMemory(input('其他会话', { source: { type: 'user', sessionId: 'b' } }));
  const result = s.completeTurn({ sessionId: 'a', turnId: 'modeled', userText: '这是一次值得记住的谈话', analysis: {
    confidence: 0.95, reason: '用户明确表达了重要性', memory: { kind: 'fact', importance: 0.92, tags: ['交流'], entities: [], semanticKeys: ['conversation'], profileFacet: 'relationship', fictional: false },
    evidenceVersions: { [existing.id]: existing.version }, proposals: [
      { type: 'summary', title: '交流经验', description: '跨经历解释', evidenceIds: [existing.id, '$current'], payload: { content: '有来源的综合候选' } },
      { type: 'summary', title: '越界', description: '不可接受', evidenceIds: [outsider.id, '$current'], payload: { content: '其他会话秘密' } },
    ],
  } });
  const memory = s.getMemory(result.memoryId, { tier: 'active' });
  assert.equal(memory.importance, 0.92); assert.equal(memory.extraction.method, 'host-model');
  assert.equal(s.listDreams().items.some(v => v.title === '越界'), false);
  const proposal = s.listDreams().items.find(v => v.title === '交流经验'); assert.ok(proposal);
  s.updateMemory(existing.id, { expectedVersion: existing.version, content: '更正之后', reason: '纠错' });
  assert.throws(() => approve(s, proposal), /变化|失效/);
  const stale = s.ingestAnalysisProposals([{ type: 'summary', title: '旧分析', description: '已经过期', evidenceIds: [existing.id, memory.id], payload: { content: '不能写入' } }], { sessionId: 'a', currentMemoryId: memory.id, evidenceVersions: { [existing.id]: 1 } });
  assert.equal(stale.items.length, 0);
  const invalid = s.completeTurn({ sessionId: 'a', turnId: 'bad-analysis', userText: '我喜欢阅读。', analysis: { confidence: 1, memory: { kind: 'fact', importance: 99, tags: [], entities: [] } } });
  assert.equal(s.getMemory(invalid.memoryId, { tier: 'active' }).extraction.method, 'local-rules');
});

test('personality versions can be restored and archival retires current and historical explanations', t => {
  const f = fixture(t); conversations(f);
  const proposal = f.s.runDream().items.find(v => v.type === 'island'); approve(f.s, proposal);
  let island = f.s.listIslands().items[0]; const first = island.history[0];
  island = f.s.updateIsland(island.id, { expectedVersion: island.version, description: 'PRIVATE_GROWTH_EXPLANATION_42' });
  assert.equal(f.s.listGrowth().items.length, 2);
  island = f.s.revertIsland(island.id, { expectedVersion: island.version, historyId: first.id });
  assert.equal(island.description, first.after.description);
  assert.ok(JSON.stringify(island.history).includes('PRIVATE_GROWTH_EXPLANATION_42'));
  const source = f.s.getMemory(island.evidenceIds[0], { tier: 'active' }); f.s.archiveMemory(source.id, { expectedVersion: source.version });
  assert.equal(JSON.stringify(f.s.listGrowth()).includes('PRIVATE_GROWTH_EXPLANATION_42'), false);
  assert.equal(JSON.stringify(f.s.listIslands()).includes('PRIVATE_GROWTH_EXPLANATION_42'), false);
  const cold = f.s._archive(() => f.s.db.prepare('SELECT data FROM cold.artifacts').all());
  assert.ok(JSON.stringify(cold).includes('PRIVATE_GROWTH_EXPLANATION_42'));
  const archived = f.s.getMemory(source.id, { tier: 'archive' }); f.s.deleteMemory(source.id, { expectedVersion: archived.version, confirmation: source.id });
  assert.equal(JSON.stringify(f.s._archive(() => f.s.db.prepare('SELECT data FROM cold.artifacts').all())).includes('PRIVATE_GROWTH_EXPLANATION_42'), false);
});

test('workspace pins enforce session visibility, versions and removal from active attention', t => {
  const { s } = fixture(t); const own = s.createMemory(input('固定工作条目')); const other = s.createMemory(input('私有B', { source: { type: 'user', sessionId: 'b' } }));
  assert.throws(() => s.updateWorkspace({ sessionId: 'a', expectedVersion: 0, pinnedMemoryIds: [other.id] }), /本会话/);
  let workspace = s.updateWorkspace({ sessionId: 'a', expectedVersion: 0, goals: [{ text: '完成报告', status: 'active' }], focus: ['进度'], energy: 0.7, pinnedMemoryIds: [own.id] });
  assert.throws(() => s.updateWorkspace({ sessionId: 'a', expectedVersion: 0, energy: 0.1 }), /变化/);
  const context = s.buildContext({ sessionId: 'a', turnId: 'pin', query: 'unrelated-query' });
  assert.ok(context.items.some(v => v.id === own.id)); assert.match(context.text, /完成报告/);
  assert.equal(s.buildContext({ sessionId: 'b', turnId: 'not-pin', query: '' }).items.some(v => v.id === own.id), false);
  s.archiveMemory(own.id, { expectedVersion: own.version }); workspace = s.getWorkspace({ sessionId: 'a' });
  assert.deepEqual(workspace.pinnedMemoryIds, []); assert.equal(s.listRecalls().items.length, 0);
});

test('recall observations capture actual state, excluded reasons and real model counters', t => {
  const { s } = fixture(t); s.createMemory(input('coffee is enjoyable')); const unrelated = s.createMemory(input('火山观察'));
  s.updateConfig({ maxRecallItems: 1 });
  s.buildContext({ sessionId: 'a', turnId: 'r', query: 'coffee' });
  s.recordModelUsage({ sessionId: 'a', turnId: 'r', purpose: 'semantic-recall', status: 'success', durationMs: 34, inputTokens: 10, outputTokens: 5, cacheReadTokens: 20 });
  const trace = s.listRecalls({ sessionId: 'a' }).items[0];
  assert.ok(trace.excluded.some(v => v.id === unrelated.id && v.reason === '相关性不足'));
  assert.ok(trace.state.emotion); assert.ok(trace.state.guidance);
  assert.equal(trace.usage[0].inputTotalTokens, 30); assert.equal(trace.usage[0].outputTokens, 5);
  assert.equal(s.listRecalls({ sessionId: 'b' }).items.length, 0);
});

test('trash undo preserves previous tier and explicit purge leaves no undo copy', t => {
  const { s } = fixture(t); const original = s.createMemory(input('TRASH_PRIVATE_42'));
  let item = s.trashMemory(original.id, { expectedVersion: 1 });
  assert.equal(s.listMemories().total, 0); assert.equal(s.listMemories({ tier: 'archive' }).total, 0); assert.equal(s.listMemories({ tier: 'archive', trashed: true }).total, 1);
  assert.throws(() => s.requestRecall(item.id, { sessionId: 'a' }), /回收箱/);
  item = s.untrashMemory(item.id, { expectedVersion: item.version }); assert.equal(item.tier, 'active'); assert.equal(item.original, 'TRASH_PRIVATE_42');
  item = s.archiveMemory(item.id, { expectedVersion: item.version, reason: 'old archive' }).memory;
  item = s.trashMemory(item.id, { expectedVersion: item.version }); item = s.untrashMemory(item.id, { expectedVersion: item.version });
  assert.equal(item.tier, 'archive'); assert.equal(item.archiveReason, 'old archive');
  item = s.trashMemory(item.id, { expectedVersion: item.version }); s.deleteMemory(item.id, { expectedVersion: item.version, confirmation: item.id });
  assert.equal(s.listMemories({ tier: 'archive', trashed: true }).total, 0); assert.equal(s.state().counts.trash, 0);
});

test('batch changes roll back stale selections and restore dependency order independently of selection order', t => {
  const { s } = fixture(t); const a = s.createMemory(input('source')); const b = s.createMemory(input('derived', { sourceIds: [a.id] }));
  assert.throws(() => s.batchMemories({ action: 'archive', items: [{ id: a.id, expectedVersion: 1 }, { id: b.id, expectedVersion: 9 }] }), /变化/);
  assert.equal(s.listMemories().total, 2);
  s.batchMemories({ action: 'archive', items: [{ id: a.id, expectedVersion: 1 }, { id: b.id, expectedVersion: 1 }] });
  const archived = s.listMemories({ tier: 'archive' }).items;
  s.batchMemories({ action: 'restore', items: [archived.find(v => v.id === b.id), archived.find(v => v.id === a.id)].map(v => ({ id: v.id, expectedVersion: v.version })) });
  assert.equal(s.listMemories().total, 2);
});

test('proactive candidates respect actual quiet hours, due dates and per-session frequency', t => {
  const f = fixture(t); const { s } = f;
  s.updateConfig({ proactiveEnabled: true, dreamEnabled: true, proactiveIntervalHours: 24, timeZone: 'Asia/Shanghai', quietHours: { start: 22, end: 8 } });
  s.createMemory(input('已到期约定1', { kind: 'commitment', dueAt: '2026-10-27T00:00:00Z' }));
  s.createMemory(input('已到期约定2', { kind: 'commitment', dueAt: '2026-10-27T00:00:00Z' }));
  s.createMemory(input('未来约定', { kind: 'commitment', dueAt: '2026-11-30T00:00:00Z' }));
  f.at('2026-10-28T15:00:00Z'); assert.equal(s.tick().skipped, 'quiet-hours'); assert.equal(s.runDream().items.filter(v => v.type === 'followup').length, 0);
  f.at('2026-10-29T01:00:00Z'); assert.equal(s.tick().items.filter(v => v.type === 'followup').length, 1);
  assert.equal(s.runDream().items.filter(v => v.type === 'followup').length, 0);
  f.advance(86400000); assert.equal(s.runDream().items.filter(v => v.type === 'followup').length, 1);
});

test('emotion reasons and recall snapshots cannot retain archived source content', t => {
  const { s } = fixture(t);
  const result = s.completeTurn({ sessionId: 'a', turnId: 'emotion', userText: 'EMOTION_PRIVATE_42', analysis: { confidence: 0.9, emotions: { joy: 0.7 }, reason: 'EMOTION_PRIVATE_42 带来喜悦' } });
  assert.match(s.emotion().reason, /EMOTION_PRIVATE_42/);
  s.buildContext({ sessionId: 'a', turnId: 'next', query: 'EMOTION_PRIVATE_42' });
  s.archiveMemory(result.memoryId, { expectedVersion: 1 });
  assert.equal(JSON.stringify(s.db.prepare('SELECT data FROM settings').all()).includes('EMOTION_PRIVATE_42'), false);
  s.resetEmotion(); assert.equal(Object.values(s.emotion().values).some(Boolean), false);
});

test('new management endpoints enforce optimistic versions and expose separate recoverable removal', t => {
  const { s } = fixture(t);
  assert.equal(handleApi(s, { path: '/workspace?sessionId=a' }).body.version, 0);
  assert.equal(handleApi(s, { method: 'PATCH', path: '/workspace', body: { sessionId: 'a', expectedVersion: 0, energy: 0.9 } }).status, 200);
  assert.equal(handleApi(s, { method: 'PATCH', path: '/workspace', body: { sessionId: 'a', expectedVersion: 0, energy: 0.1 } }).status, 409);
  assert.equal(handleApi(s, { method: 'POST', path: '/emotion/reset' }).status, 200);
  const m = s.createMemory(input('API removal'));
  const trash = handleApi(s, { method: 'POST', path: `/memories/${m.id}/trash`, body: { expectedVersion: m.version } }); assert.equal(trash.status, 200);
  const restored = handleApi(s, { method: 'POST', path: `/memories/${m.id}/untrash`, body: { expectedVersion: trash.body.version } }); assert.equal(restored.body.tier, 'active');
});
