import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InsideOutService } from '../src/core/service.js';

function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'insideout-growth-boundaries-'));
  let now = Date.parse('2026-10-26T04:00:00Z');
  let service = new InsideOutService({ dataDir, clock: () => new Date(now) });
  t.after(() => { service.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return {
    get s() { return service; }, dataDir,
    advance() { now += 86_400_000; },
    reopen() { service.close(); service = new InsideOutService({ dataDir, clock: () => new Date(now) }); return service; },
  };
}
const input = (content, extra = {}) => ({ content, source: { type: 'user', sessionId: 'a' }, ...extra });
const approve = (s, proposal) => s.decideDream(proposal.id, { expectedVersion: proposal.version, action: 'approve' });
const evidenceVersions = items => Object.fromEntries(items.map(item => [item.id, item.version]));

function approvedIsland(f, description) {
  for (const [index, userText] of ['我喜欢喝无糖拿铁。', '我每天早上会喝一杯不加糖的咖啡。', '我还是偏爱咖啡，尤其是不加糖的浓缩咖啡。'].entries()) {
    f.s.completeTurn({ sessionId: 'a', turnId: `island-${index}`, userText });
    f.advance();
  }
  const proposal = f.s.runDream().items.find(item => item.type === 'island' && item.payload.title === '咖啡');
  assert.ok(proposal, 'ordinary conversations must provide the island evidence');
  approve(f.s, proposal);
  const island = f.s.listIslands().items.find(item => item.title === '咖啡');
  return f.s.updateIsland(island.id, { expectedVersion: island.version, description });
}

function archiveIslandEvidence(s, island) {
  for (const memoryId of island.evidenceIds) {
    const memory = s.getMemory(memoryId, { tier: 'active' });
    s.archiveMemory(memoryId, { expectedVersion: memory.version });
  }
  const artifact = s.listArchivedIslands(island.id).items.find(item => item.description === island.description);
  assert.ok(artifact, 'the original island description must have a readable archive snapshot');
  return artifact;
}

function restoreIslandEvidence(s, island) {
  for (const memoryId of island.evidenceIds) {
    const memory = s.getMemory(memoryId, { tier: 'archive' });
    s.restoreMemory(memoryId, { expectedVersion: memory.version });
  }
}

test('all analysis inputs remain dependencies and retiring background preserves raw conversation without a metadata bypass', t => {
  const f = fixture(t); let s = f.s; s.updateConfig({ dreamEnabled: true });
  const marker = 'BACKGROUND_DERIVATION_PRIVATE_7b91';
  const explicit = s.createMemory(input('可明确引用的一次经历'));
  const omitted = s.createMemory(input(`仅作为分析背景的经历 ${marker}`));
  const other = s.createMemory(input('另一条背景经历'));
  const snapshot = s.analysisContext({ sessionId: 'a' });
  assert.equal(snapshot.items.length, 3);
  const raw = '这次谈话让我开始重新整理最近的经历。';
  const completed = s.completeTurn({ sessionId: 'a', turnId: 'modeled', userText: raw, analysis: {
    confidence: 0.95, reason: `情绪理由来自背景 ${marker}`, evidenceVersions: evidenceVersions(snapshot.items),
    emotions: { joy: 0.8 },
    memory: { kind: 'fact', importance: 0.88, tags: [marker], entities: [marker], semanticKeys: [marker], profileFacet: 'value', reason: `提炼理由 ${marker}` },
    // The model omits the sensitive input from the explicit citation list.
    proposals: [{ type: 'summary', title: '本轮分析归纳', description: '综合本轮与已知经历', evidenceIds: [explicit.id, '$current'], payload: { content: `背景支持的解释 ${marker}` } }],
  } });
  const current = s.getMemory(completed.memoryId, { tier: 'active' });
  assert.deepEqual(new Set(current.analysisEvidenceIds), new Set([explicit.id, omitted.id, other.id]));
  assert.deepEqual(new Set(s.emotion().sourceIds), new Set([current.id, explicit.id, omitted.id, other.id]));
  const proposal = s.listDreams().items.find(item => item.title === '本轮分析归纳');
  assert.ok(proposal); approve(s, proposal);
  const summary = s.listMemories().items.find(item => item.kind === 'reflection' && item.content.includes(marker));
  assert.ok(summary);
  assert.ok(summary.sourceIds.includes(omitted.id), 'approved output must depend on background the model did not cite');
  s.buildContext({ sessionId: 'a', turnId: 'before-archive', query: marker });

  s.archiveMemory(omitted.id, { expectedVersion: omitted.version });
  s = f.reopen();
  const retained = s.getMemory(current.id, { tier: 'active' });
  assert.equal(JSON.parse(retained.original).user, raw);
  assert.equal(retained.content, `用户陈述：${raw}`);
  assert.equal(retained.extraction.method, 'local-rules-after-invalidation');
  assert.deepEqual(retained.analysisEvidenceIds, []);
  assert.equal(s.getMemory(summary.id, { tier: 'archive' }).tier, 'archive');
  const activeView = { memories: s.listMemories(), state: s.state(), dreams: s.listDreams(), recalls: s.listRecalls(), context: s.buildContext({ sessionId: 'a', turnId: 'after-archive', query: marker }) };
  assert.equal(JSON.stringify(activeView).includes(marker), false);
  assert.ok(JSON.stringify(s.listAnalysisHistory(current.id)).includes(marker), 'retired metadata remains explicitly readable in archive history');

  const archived = s.getMemory(omitted.id, { tier: 'archive' });
  s.deleteMemory(omitted.id, { expectedVersion: archived.version, confirmation: omitted.id });
  s = f.reopen();
  assert.equal(JSON.parse(s.getMemory(current.id, { tier: 'active' }).original).user, raw);
  assert.equal(JSON.stringify(s.listAnalysisHistory(current.id)).includes(marker), false);
  assert.equal(JSON.stringify(s.listMemories({ tier: 'archive' })).includes(marker), false);
  for (const tier of ['active', 'archive']) assert.equal(readFileSync(join(f.dataDir, tier, 'insideout.sqlite')).includes(Buffer.from(marker)), false, `${tier} current database must not retain the deleted derived marker`);
});

test('restoring every unchanged island source permits archived history recovery but requires separate activation', t => {
  const f = fixture(t);
  const island = approvedIsland(f, 'RESTORED_ISLAND_EXPLANATION_1c42');
  const artifact = archiveIslandEvidence(f.s, island);
  let current = f.s.listIslands().items.find(item => item.id === island.id);
  assert.throws(() => f.s.restoreIsland(island.id, { expectedVersion: current.version, artifactId: artifact.id }), { code: 'STALE_EVIDENCE' });
  restoreIslandEvidence(f.s, island);
  const s = f.reopen(); current = s.listIslands().items.find(item => item.id === island.id);
  const restored = s.restoreIsland(island.id, { expectedVersion: current.version, artifactId: artifact.id });
  assert.equal(restored.description, island.description);
  assert.deepEqual(restored.evidenceIds, island.evidenceIds);
  assert.equal(restored.enabled, false);
  assert.ok(restored.history.some(item => item.action === 'archive-restored-disabled'));
  assert.equal(s.buildContext({ sessionId: 'a', turnId: 'still-disabled', query: '咖啡' }).text.includes(island.description), false);
  const enabled = s.updateIsland(island.id, { expectedVersion: restored.version, enabled: true });
  assert.equal(enabled.enabled, true);
  assert.ok(s.buildContext({ sessionId: 'a', turnId: 'explicitly-enabled', query: '咖啡' }).text.includes(island.description));
});

test('an archived island cannot reuse old source fingerprints after restored evidence is corrected', t => {
  const f = fixture(t);
  const island = approvedIsland(f, 'STALE_ISLAND_EXPLANATION_5f83');
  const artifact = archiveIslandEvidence(f.s, island);
  restoreIslandEvidence(f.s, island);
  const source = f.s.getMemory(island.evidenceIds[0], { tier: 'active' });
  f.s.updateMemory(source.id, { expectedVersion: source.version, content: '更正：我现在明确不喜欢咖啡。', reason: '用户纠正先前说法' });
  const current = f.s.listIslands().items.find(item => item.id === island.id);
  assert.throws(() => f.s.restoreIsland(island.id, { expectedVersion: current.version, artifactId: artifact.id }), { code: 'STALE_EVIDENCE' });
  assert.equal(f.s.listIslands().items.find(item => item.id === island.id).enabled, false);
  assert.equal(JSON.stringify(f.s.listGrowth()).includes(island.description), false);
  assert.ok(f.s.listArchivedIslands(island.id).items.some(item => item.id === artifact.id));
});

test('an analysis background version race rejects all stale model output while preserving the completed raw turn', t => {
  const f = fixture(t); const { s } = f; s.updateConfig({ dreamEnabled: true });
  const changed = s.createMemory(input('分析开始前的背景'));
  const cited = s.createMemory(input('未变化的明确来源'));
  const snapshot = s.analysisContext({ sessionId: 'a' });
  s.updateMemory(changed.id, { expectedVersion: changed.version, content: '分析进行时用户已更正背景', reason: '并发更正' });
  const marker = 'STALE_MODEL_OUTPUT_9ad3';
  const raw = '我喜欢阅读。', assistantText = '这是合成测试助手回复。';
  const completed = s.completeTurn({ sessionId: 'a', turnId: 'racing-analysis', userText: raw, assistantText, analysis: {
    confidence: 0.99, reason: marker, evidenceVersions: evidenceVersions(snapshot.items), emotions: { anger: 0.9 },
    memory: { kind: 'fact', importance: 0.99, tags: [marker], entities: [marker], semanticKeys: [marker], profileFacet: 'value', reason: marker },
    proposals: [{ type: 'summary', title: marker, description: marker, evidenceIds: [cited.id, '$current'], payload: { content: marker } }],
  } });
  assert.equal(completed.captured, true);
  const memory = s.getMemory(completed.memoryId, { tier: 'active' });
  assert.deepEqual(JSON.parse(memory.original), { user: raw, assistant: assistantText });
  assert.equal(memory.extraction.method, 'local-rules');
  assert.equal(memory.kind, 'preference');
  assert.ok(memory.tags.includes('阅读'));
  assert.equal(Object.values(s.emotion().values).some(Boolean), false);
  assert.equal(JSON.stringify({ memories: s.listMemories(), state: s.state(), dreams: s.listDreams() }).includes(marker), false);
  assert.ok(s.listLogs().items.some(item => item.action === 'memory.analysis-stale'));
  assert.equal(s.completeTurn({ sessionId: 'a', turnId: 'racing-analysis', userText: raw }).duplicate, true);
  assert.equal(f.reopen().getMemory(memory.id, { tier: 'active' }).original, memory.original);
});
