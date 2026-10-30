import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InsideOutService } from '../src/core/service.js';
import { MemoryDefaults } from '../src/core/policy.js';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'insideout-policy-import-'));
  const services = new Set(), stores = new Set();
  const clock = () => new Date('2026-10-30T04:00:00Z');
  const defaults = (name = 'profile-a') => {
    const store = new MemoryDefaults({ dataDir: join(root, name), scope: 'profile' });
    stores.add(store); return store;
  };
  const shared = defaults();
  const scope = (name, store = shared) => {
    const service = new InsideOutService({ dataDir: join(root, name), clock, ...(store ? { defaults: store } : {}) });
    services.add(service); return service;
  };
  t.after(() => { for (const s of services) s.close(); for (const store of stores) store.close(); rmSync(root, { recursive: true, force: true }); });
  return { root, shared, defaults, scope, closeService(s) { s.close(); services.delete(s); } };
}
const memory = (s, content, sessionId = 'source', extra = {}) => s.createMemory({ content, source: { type: 'user', sessionId }, ...extra });
const defaultEnabled = (s, enabled) => s.updateMemoryDefault({ expectedVersion: s.getMemoryDefault().version, enabled });
const override = (s, sessionId, value) => s.updateSessionMemory({ sessionId, expectedVersion: s.getSessionMemory({ sessionId }).version, override: value });
const register = (s, ...ids) => ids.forEach(sessionId => s.registerSession({ sessionId, title: `合成会话 ${sessionId}` }));
const preview = (s, options) => s.previewImport({ source: 'memories', targetSessionId: 'target', offset: 0, limit: 200, ...options });
const selected = result => result.items.filter(item => item.status === 'ready').map(item => item.id);
const importIds = (s, ids, targetSessionId = 'target') => {
  const candidate = preview(s, { memoryIds: ids, targetSessionId });
  return s.commitImport({ previewId: candidate.previewId, recordIds: selected(candidate) });
};
const conflict = fn => assert.throws(fn, error => error.status === 409);
const ids = result => result.items.map(item => item.id);

test('profile memory default updates every inherited scope, new scopes and reopened scopes without changing another profile', t => {
  const h = fixture(t), a = h.scope('a'), b = h.scope('b'), foreign = h.scope('foreign', h.defaults('profile-b'));
  register(a, 'a'); register(b, 'b'); register(foreign, 'other');
  defaultEnabled(a, true); defaultEnabled(foreign, true);
  assert.equal(b.getSessionMemory({ sessionId: 'b' }).effectiveEnabled, true);
  override(b, 'b', 'on');
  const old = a.getMemoryDefault();
  defaultEnabled(a, false);
  assert.equal(a.memoryEnabled('a'), false);
  assert.equal(b.memoryEnabled('b'), true, 'an explicit on override survives a changed default');
  assert.equal(b.getSessionMemory({ sessionId: 'b' }).defaultEnabled, false);
  assert.equal(foreign.memoryEnabled('other'), true);
  const c = h.scope('new-scope'); register(c, 'c');
  assert.equal(c.memoryEnabled('c'), false, 'a future scope inherits the persisted profile default');
  conflict(() => a.updateMemoryDefault({ expectedVersion: old.version, enabled: true }));
  assert.equal(a.getMemoryDefault().enabled, false);
  h.closeService(a);
  const reloaded = h.scope('a', h.defaults());
  assert.equal(reloaded.memoryEnabled('a'), false);
  assert.equal(reloaded.getSessionMemory({ sessionId: 'a' }).override, 'inherit');
  override(b, 'b', 'inherit');
  assert.equal(b.memoryEnabled('b'), false);
});

test('session tri-state, standalone persistence and the existing scope pause have independent versioned effects', t => {
  const h = fixture(t); let s = h.scope('standalone', null); register(s, 'a', 'b');
  defaultEnabled(s, false);
  assert.equal(s.getSessionMemory({ sessionId: 'a' }).override, 'inherit');
  assert.equal(s.memoryEnabled('a'), false);
  let policy = override(s, 'a', 'on');
  assert.equal(policy.effectiveEnabled, true); assert.equal(policy.defaultEnabled, false);
  assert.equal(s.memoryEnabled('b'), false);
  const previous = policy;
  policy = override(s, 'a', 'off');
  conflict(() => s.updateSessionMemory({ sessionId: 'a', expectedVersion: previous.version, override: 'on' }));
  assert.equal(s.memoryEnabled('a'), false);
  defaultEnabled(s, true);
  assert.equal(s.memoryEnabled('a'), false, 'explicit off is independent of the new default');
  assert.equal(s.memoryEnabled('b'), true);
  override(s, 'a', 'inherit'); assert.equal(s.memoryEnabled('a'), true);
  override(s, 'a', 'on'); s.updateConfig({ enabled: false });
  assert.equal(s.getSessionMemory({ sessionId: 'a' }).scopeEnabled, false);
  assert.equal(s.memoryEnabled('a'), false, 'scope hard pause still wins over session on');
  s.updateConfig({ enabled: true }); assert.equal(s.memoryEnabled('a'), true);
  const saved = s.getSessionMemory({ sessionId: 'a' });
  for (const invalid of [true, false, null, '', 'enabled']) assert.throws(() => s.updateSessionMemory({ sessionId: 'a', expectedVersion: saved.version, override: invalid }));
  assert.equal(s.getSessionMemory({ sessionId: 'a' }).version, saved.version);
  h.closeService(s); s = h.scope('standalone', null);
  assert.equal(s.getMemoryDefault().enabled, true);
  assert.equal(s.getSessionMemory({ sessionId: 'a' }).override, 'on');
});

test('disabling memory immediately hides cached and model-facing data and a changed policy stamp rejects delayed capture', t => {
  const h = fixture(t), s = h.scope('scope'); register(s, 'a', 'b'); defaultEnabled(s, true);
  const marker = 'DISABLED_SESSION_PRIVATE_1f48';
  const source = memory(s, marker, 'a');
  const cached = s.buildContext({ sessionId: 'a', turnId: 'cached', query: marker });
  assert.ok(cached.text.includes(marker));
  const staleStamp = s.getSessionMemory({ sessionId: 'a' }).stamp;
  override(s, 'a', 'off');
  assert.equal(Boolean(s.peekContext({ sessionId: 'a', turnId: 'cached' })?.text), false);
  assert.equal(s.buildContext({ sessionId: 'a', turnId: 'cached', query: marker }).text, '');
  for (const result of [s.searchActive({ sessionId: 'a', query: marker }), s.analysisContext({ sessionId: 'a' })]) {
    assert.equal(result.disabled, true); assert.deepEqual(result.items, []);
  }
  const disabled = s.completeTurn({ sessionId: 'a', turnId: 'while-off', userText: '不应自动记录', policyStamp: staleStamp });
  assert.equal(disabled.captured, false);
  assert.equal(s.listMemories().total, 1, 'management keeps the saved record while automatic memory is disabled');
  assert.equal(s.getMemory(source.id, { tier: 'active' }).version, source.version);
  assert.equal(s.memoryEnabled('b'), true);
  override(s, 'a', 'on');
  const delayed = s.completeTurn({ sessionId: 'a', turnId: 'old-epoch', userText: '迟到的原话不得进入新策略', policyStamp: staleStamp, analysis: {
    confidence: 1, emotions: { anger: 0.9 }, reason: '迟到模型结果',
    memory: { kind: 'fact', importance: 0.9, tags: ['迟到'], entities: [], semanticKeys: [] },
  } });
  assert.equal(delayed.captured, false);
  assert.equal(s.listMemories().total, 1);
  assert.equal(Object.values(s.emotion().values).some(Boolean), false);
  const accepted = s.completeTurn({ sessionId: 'a', turnId: 'fresh-policy', userText: '我喜欢阅读。', policyStamp: s.getSessionMemory({ sessionId: 'a' }).stamp });
  assert.equal(accepted.captured, true);
});

test('explicit record import grants only selected same-scope references, keeps provenance and is idempotent while target is off', t => {
  const h = fixture(t), s = h.scope('scope'); register(s, 'source', 'target', 'unrelated'); defaultEnabled(s, true);
  const chosen = memory(s, 'CHOSEN_REFERENCE_13ac'), unchosen = memory(s, 'UNSELECTED_REFERENCE_67de');
  const original = s.getMemory(chosen.id, { tier: 'active' });
  override(s, 'target', 'off');
  const candidate = preview(s, { memoryIds: [chosen.id] });
  assert.equal(candidate.targetPolicy.effectiveEnabled, false);
  assert.deepEqual(selected(candidate), [chosen.id]);
  const first = s.commitImport({ previewId: candidate.previewId, recordIds: [chosen.id] });
  assert.equal(first.createdCount, 0); assert.equal(first.linkedCount, 1);
  assert.equal(first.imported[0].id, chosen.id);
  assert.equal(s.memoryEnabled('target'), false, 'explicit import never enables a disabled target');
  assert.deepEqual(s.searchActive({ sessionId: 'target', query: 'CHOSEN_REFERENCE_13ac' }).items, []);
  const replay = s.commitImport({ previewId: candidate.previewId, recordIds: [chosen.id] });
  assert.equal(replay.createdCount, 0); assert.equal(replay.linkedCount, 0); assert.equal(replay.skippedCount, 1);
  assert.equal(preview(s, { memoryIds: [chosen.id] }).items[0].status, 'already');
  assert.equal(s.listMemories().total, 2);
  assert.deepEqual(s.getMemory(chosen.id, { tier: 'active' }), original, 'linking must not rewrite source ownership, version, content or visibility');
  override(s, 'target', 'on');
  assert.deepEqual(ids(s.searchActive({ sessionId: 'target', query: 'CHOSEN_REFERENCE_13ac' })), [chosen.id]);
  assert.ok(ids(s.analysisContext({ sessionId: 'target' })).includes(chosen.id));
  assert.ok(!ids(s.analysisContext({ sessionId: 'target' })).includes(unchosen.id));
  assert.deepEqual(s.searchActive({ sessionId: 'unrelated', query: 'CHOSEN_REFERENCE_13ac' }).items, []);
});

test('whole-session import freezes active selection and never includes future, archived or trashed records', t => {
  const h = fixture(t), s = h.scope('scope'); register(s, 'source', 'target'); defaultEnabled(s, true);
  const active = memory(s, 'ACTIVE_AT_PREVIEW');
  const archived = memory(s, 'ARCHIVE_AT_PREVIEW'); s.archiveMemory(archived.id, { expectedVersion: archived.version });
  const trash = memory(s, 'TRASH_AT_PREVIEW'); s.trashMemory(trash.id, { expectedVersion: trash.version });
  const candidate = preview(s, { sourceSessionId: 'source' });
  assert.deepEqual(selected(candidate), [active.id]);
  assert.deepEqual(s.searchActive({ sessionId: 'target', query: 'ACTIVE_AT_PREVIEW' }).items, [], 'preview alone is not authorization');
  const future = memory(s, 'CREATED_AFTER_PREVIEW');
  const imported = s.commitImport({ previewId: candidate.previewId, recordIds: selected(candidate) });
  assert.equal(imported.linkedCount, 1); assert.equal(imported.createdCount, 0);
  const visible = ids(s.analysisContext({ sessionId: 'target' }));
  assert.ok(visible.includes(active.id));
  for (const item of [future, archived, trash]) assert.ok(!visible.includes(item.id));
  assert.equal(s.getMemory(archived.id, { tier: 'archive' }).tier, 'archive');
  assert.ok(s.getMemory(trash.id, { tier: 'archive' }).trashedAt);
});

test('import previews include source dependencies and stale selected records fail atomically without cross-scope fallback', t => {
  const h = fixture(t), s = h.scope('scope'), foreign = h.scope('different-scope');
  register(s, 'source', 'target'); register(foreign, 'other'); defaultEnabled(s, true);
  const basis = memory(s, 'SOURCE_CLOSURE_243b');
  const derived = memory(s, 'DERIVED_CLOSURE_243b', 'source', { sourceIds: [basis.id], kind: 'reflection' });
  const candidate = preview(s, { memoryIds: [derived.id] });
  assert.deepEqual(selected(candidate), [derived.id]);
  assert.equal(candidate.items[0].dependencyCount, 1);
  assert.deepEqual(candidate.items[0].dependencies.map(dependency => dependency.id), [basis.id]);
  s.updateMemory(basis.id, { expectedVersion: basis.version, content: '用户在预览后已更正来源', reason: '验证提交前重验' });
  conflict(() => s.commitImport({ previewId: candidate.previewId, recordIds: selected(candidate) }));
  assert.deepEqual(s.analysisContext({ sessionId: 'target' }).items, []);
  const outsider = memory(foreign, 'OTHER_SCOPE_NOT_IMPORTABLE', 'other');
  const count = s.listMemories().total;
  try {
    const invalid = preview(s, { memoryIds: [outsider.id] });
    assert.ok(invalid.items.every(item => item.status === 'blocked'));
  } catch (error) { assert.ok(error.status >= 400 && error.status < 500); }
  assert.equal(s.listMemories().total, count);
  assert.deepEqual(s.searchActive({ sessionId: 'target', query: 'OTHER_SCOPE_NOT_IMPORTABLE' }).items, []);
});

test('source corrections, trash and deletion invalidate imported access and dependent model metadata without deleting later raw input', t => {
  const h = fixture(t), s = h.scope('scope'); register(s, 'source', 'target'); defaultEnabled(s, true);
  const marker = 'IMPORTED_BACKGROUND_PRIVATE_d841';
  let source = memory(s, marker);
  importIds(s, [source.id]);
  const completed = s.completeTurn({ sessionId: 'target', turnId: 'modeled-target', userText: '后续独立原话应保留。', analysis: {
    confidence: 0.95, evidenceVersions: { [source.id]: source.version }, reason: marker, emotions: { joy: 0.7 },
    memory: { kind: 'fact', importance: 0.8, tags: [marker], entities: [], semanticKeys: [marker], reason: marker },
  } });
  const later = s.getMemory(completed.memoryId, { tier: 'active' });
  assert.equal(later.extraction.method, 'host-model');
  const derived = memory(s, `导入来源解释 ${marker}`, 'target', { sourceIds: [source.id], kind: 'reflection' });
  s.buildContext({ sessionId: 'target', turnId: 'import-cached', query: marker });
  source = s.updateMemory(source.id, { expectedVersion: source.version, content: '修订后不应沿用旧导入授权', reason: '源会话纠正' });
  assert.equal(Boolean(s.peekContext({ sessionId: 'target', turnId: 'import-cached' })?.text), false);
  const retained = s.getMemory(later.id, { tier: 'active' });
  assert.equal(JSON.parse(retained.original).user, '后续独立原话应保留。');
  assert.equal(retained.extraction.method, 'local-rules-after-invalidation');
  assert.equal(s.getMemory(derived.id, { tier: 'archive' }).tier, 'archive');
  assert.ok(!ids(s.analysisContext({ sessionId: 'target' })).includes(source.id));
  assert.equal(JSON.stringify({ visible: s.analysisContext({ sessionId: 'target' }), emotion: s.emotion() }).includes(marker), false);

  importIds(s, [source.id]);
  assert.ok(ids(s.analysisContext({ sessionId: 'target' })).includes(source.id));
  source = s.trashMemory(source.id, { expectedVersion: source.version });
  assert.ok(!ids(s.analysisContext({ sessionId: 'target' })).includes(source.id));
  source = s.untrashMemory(source.id, { expectedVersion: source.version });
  assert.equal(source.tier, 'active');
  assert.ok(!ids(s.analysisContext({ sessionId: 'target' })).includes(source.id), 'restoring the source does not silently recreate invalidated import access');
  importIds(s, [source.id]);
  s.deleteMemory(source.id, { expectedVersion: source.version, confirmation: source.id });
  assert.ok(!ids(s.analysisContext({ sessionId: 'target' })).includes(source.id));
  assert.equal(JSON.stringify(s.listAnalysisHistory(later.id)).includes(marker), false);
});

test('trusted DSH import uses local extraction, preserves source provenance and deduplicates against live capture', t => {
  const h = fixture(t), s = h.scope('scope'); register(s, 'historic-source', 'target'); defaultEnabled(s, true);
  const record = { key: 'historic-turn-1', userText: '我喜欢阅读。', assistantText: '历史助手原文只作来源保存。', eventAt: '2026-10-20T04:00:00.000Z', sourceSessionId: 'historic-source', turnId: '1', ref: 'dsh:historic-source:1', sourceFingerprint: 'stable-source-fingerprint' };
  const trusted = { records: [record], sourceSignature: 'dsh-snapshot-1', sourceInfo: { sessionId: 'historic-source', title: '历史合成会话' } };
  override(s, 'target', 'off');
  const candidate = s.previewImport({ source: 'dsh', sourceSessionId: 'historic-source', targetSessionId: 'target', offset: 0, limit: 200 }, trusted);
  const imported = s.commitImport({ previewId: candidate.previewId, recordIds: selected(candidate) }, trusted);
  assert.equal(imported.createdCount, 1);
  assert.equal(s.memoryEnabled('target'), false);
  const item = s.getMemory(imported.imported[0].id, { tier: 'active' });
  assert.equal(item.kind, 'preference'); assert.ok(item.tags.includes('阅读'));
  assert.equal(item.source.type, 'import'); assert.equal(item.source.sessionId, record.sourceSessionId); assert.equal(item.source.turnId, record.turnId);
  assert.equal(item.eventAt, record.eventAt);
  assert.ok(item.original.includes(record.userText)); assert.ok(item.original.includes(record.assistantText));
  assert.equal(item.extraction.method, 'local-rules');
  const replay = s.commitImport({ previewId: candidate.previewId, recordIds: selected(candidate) }, trusted);
  assert.equal(replay.createdCount, 0); assert.equal(replay.skippedCount, 1);
  const live = s.completeTurn({ sessionId: record.sourceSessionId, turnId: record.turnId, userText: record.userText, assistantText: record.assistantText });
  assert.equal(live.captured, false); assert.equal(s.listMemories().total, 1);
});

test('DSH import rechecks selected fingerprints, tolerates unrelated appended turns and cannot revive archived or deleted sources', t => {
  const h = fixture(t), s = h.scope('scope'); register(s, 'historic-source', 'target'); defaultEnabled(s, true);
  const records = [1, 2].map(index => ({ key: `historic-${index}`, userText: `历史合成记录 ${index}`, assistantText: '', eventAt: '2026-10-20T04:00:00.000Z', sourceSessionId: 'historic-source', turnId: String(index), ref: `dsh:historic-source:${index}`, sourceFingerprint: `fingerprint-${index}` }));
  const trusted = { records, sourceSignature: 'source-v1', sourceInfo: { sessionId: 'historic-source' } };
  const request = { source: 'dsh', sourceSessionId: 'historic-source', targetSessionId: 'target', offset: 0, limit: 200 };
  const stale = s.previewImport(request, trusted);
  conflict(() => s.commitImport({ previewId: stale.previewId, recordIds: selected(stale) }, { ...trusted, sourceSignature: 'source-v2', records: records.map((record, index) => index ? record : { ...record, userText: '已修订的历史消息', sourceFingerprint: 'fingerprint-1-corrected' }) }));
  assert.equal(s.listMemories().total, 0);
  const current = s.previewImport(request, trusted);
  const appended = { ...trusted, sourceSignature: 'source-v3', records: [...records, { ...records[0], key: 'historic-3', turnId: '3', userText: '预览后的无关新增回合', sourceFingerprint: 'fingerprint-3' }] };
  const imported = s.commitImport({ previewId: current.previewId, recordIds: selected(current) }, appended);
  assert.equal(imported.createdCount, 2);
  assert.equal(s.listMemories().total, 2, 'newly appended source turns are not silently added to the frozen selection');
  const a = s.getMemory(imported.imported[0].id, { tier: 'active' }), b = s.getMemory(imported.imported[1].id, { tier: 'active' });
  s.archiveMemory(a.id, { expectedVersion: a.version });
  s.deleteMemory(b.id, { expectedVersion: b.version, confirmation: b.id });
  const retry = s.previewImport(request, trusted);
  assert.equal(selected(retry).length, 0);
  assert.ok(retry.items.every(item => item.status === 'blocked'));
  assert.equal(s.listMemories().total, 0); assert.equal(s.listMemories({ tier: 'archive' }).total, 1);
});

test('JSON file shapes retain raw provenance without accepting authority fields or updating live emotion and policy', t => {
  const h = fixture(t), s = h.scope('files'); register(s, 'target'); defaultEnabled(s, true); override(s, 'target', 'off');
  const emotion = s.emotion(), policy = s.getSessionMemory({ sessionId: 'target' });
  const record = { content: 'JSON_OBJECT_RAW_MARKER', title: '文件记录', kind: 'fact', eventAt: '2026-10-01T03:00:00Z', tags: ['源标签'], visibility: 'workspace', subject: 'agent', source: { type: 'user', sessionId: 'forged-owner' }, sourceIds: ['untrusted-evidence-id'], core: true };
  const values = [record, ['JSON_ARRAY_STRING', { text: 'JSON_ARRAY_OBJECT' }], { memories: [{ content: 'JSON_MEMORIES_WRAPPER' }] }, { records: [{ content: 'JSON_RECORDS_WRAPPER' }] }, { messages: [{ role: 'system', content: '不能变成系统权限' }, { role: 'user', content: 'JSON_USER_MESSAGE' }, { role: 'assistant', content: [{ type: 'text', text: 'JSON_ASSISTANT_MESSAGE' }] }] }];
  for (const [index, value] of values.entries()) {
    const file = { name: `selected-${index}.json`, format: 'json', content: `${index === 0 ? '\uFEFF' : ''}${JSON.stringify(value)}` };
    const candidate = s.previewImport({ source: 'file', targetSessionId: 'target', file });
    assert.equal(candidate.sourceInfo.fileHash, createHash('sha256').update(file.content, 'utf8').digest('hex'));
    assert.equal(s.listMemories().total, index === 0 ? 0 : [0, 1, 3, 4, 5][index], 'a file preview never writes records');
    const result = s.commitImport({ previewId: candidate.previewId, recordIds: selected(candidate) });
    assert.equal(result.createdCount, candidate.items.length);
    for (const item of result.imported) {
      const saved = s.getMemory(item.id, { tier: 'active' });
      assert.equal(saved.source.type, 'import'); assert.equal(saved.source.sessionId, 'target');
      assert.equal(saved.source.ref, file.name); assert.equal(saved.visibility, 'session'); assert.equal(saved.subject, 'world');
      assert.deepEqual(saved.sourceIds, []); assert.equal(saved.core, false);
      assert.equal(saved.importOrigin.kind, 'file'); assert.equal(saved.importOrigin.name, file.name);
      assert.equal(saved.importOrigin.fileHash, candidate.sourceInfo.fileHash);
    }
    if (index === 0) {
      const saved = s.getMemory(result.imported[0].id, { tier: 'active' });
      assert.equal(saved.original, JSON.stringify(record)); assert.equal(saved.eventAt, '2026-10-01T03:00:00.000Z');
      assert.equal(saved.kind, 'fact'); assert.deepEqual(saved.tags, ['源标签']);
    }
    if (index === 4) {
      assert.equal(result.createdCount, 2);
      const messages = result.imported.map(item => s.getMemory(item.id, { tier: 'active' }));
      assert.equal(messages.find(item => item.content.includes('JSON_USER_MESSAGE')).fictional, false);
      assert.equal(messages.find(item => item.content.includes('JSON_ASSISTANT_MESSAGE')).fictional, true);
      assert.ok(messages.every(item => !item.content.includes('不能变成系统权限')));
    }
  }
  assert.equal(s.listMemories().total, 7); assert.deepEqual(s.emotion(), emotion);
  assert.deepEqual(s.getSessionMemory({ sessionId: 'target' }), policy);
  assert.equal(s.listDreams().items.length, 0);
  override(s, 'target', 'on');
  for (const result of [s.searchActive({ sessionId: 'target', query: 'JSON_OBJECT_RAW_MARKER' }), s.analysisContext({ sessionId: 'target', query: 'JSON_OBJECT_RAW_MARKER' })]) {
    const item = result.items.find(item => item.content === record.content);
    assert.ok(item); assert.equal(item.subject, 'world'); assert.equal(item.sourceType, 'import'); assert.match(item.sourceNotice, /外部文件.*未经核验/);
  }
  const recalled = s.buildContext({ sessionId: 'target', turnId: 'file-provenance', query: 'JSON_OBJECT_RAW_MARKER' });
  assert.match(recalled.text, /"subject":"world"/); assert.match(recalled.text, /"source":"import"/); assert.match(recalled.text, /外部文件.*未经核验/);
});

test('TXT and Markdown imports retain every original character across whitespace and surrogate boundaries', t => {
  const h = fixture(t), s = h.scope('text-files'); register(s, 'target');
  for (const format of ['txt', 'md']) {
    const content = '\uFEFF' + ' '.repeat(60000) + 'a'.repeat(59999) + '😀' + `\n# ${format}完整段落\n` + '\t '.repeat(34000);
    const file = { name: `exact.${format}`, format, content };
    const candidate = s.previewImport({ source: 'file', targetSessionId: 'target', file });
    assert.ok(candidate.items.length > 2);
    const result = s.commitImport({ previewId: candidate.previewId, recordIds: selected(candidate) });
    assert.equal(result.createdCount, candidate.items.length);
    const imported = result.imported.map(item => s.getMemory(item.id, { tier: 'active' }));
    const reconstructed = imported.map(item => item.original).join('');
    assert.equal(reconstructed, content); assert.equal(reconstructed.charCodeAt(0), 0xFEFF);
    const expectedHash = createHash('sha256').update(content, 'utf8').digest('hex');
    assert.equal(candidate.sourceInfo.fileHash, expectedHash);
    assert.equal(createHash('sha256').update(reconstructed, 'utf8').digest('hex'), expectedHash);
    assert.equal(candidate.sourceInfo.bytes, Buffer.byteLength(content, 'utf8'));
    assert.ok(imported.every(item => item.content.trim() && item.content.length <= 64000 && item.original.length <= 60000));
    assert.ok(imported.every(item => !/[\uD800-\uDBFF]$/.test(item.original)));
  }
});

test('file selection and replay are explicit, cross-target imports reuse the source, and deleted file entries stay deleted', t => {
  const h = fixture(t), s = h.scope('file-dedup'); register(s, 'target', 'second'); defaultEnabled(s, true); override(s, 'target', 'off');
  const file = { name: 'first.json', format: 'json', content: JSON.stringify([{ content: 'FILE_SELECTED_SOURCE_42de' }, { content: 'FILE_UNSELECTED_47ac' }]) };
  const candidate = s.previewImport({ source: 'file', targetSessionId: 'target', file });
  const firstKey = candidate.items[0].id, secondKey = candidate.items[1].id;
  const result = s.commitImport({ previewId: candidate.previewId, recordIds: [firstKey] });
  assert.equal(result.createdCount, 1); assert.equal(s.listMemories().total, 1); assert.equal(s.memoryEnabled('target'), false);
  const source = s.getMemory(result.imported[0].id, { tier: 'active' });
  const replay = s.commitImport({ previewId: candidate.previewId, recordIds: [firstKey] });
  assert.equal(replay.createdCount, 0); assert.equal(replay.linkedCount, 0); assert.equal(replay.skippedCount, 1);
  const second = s.previewImport({ source: 'file', targetSessionId: 'second', file: { ...file, name: 'renamed.json' } });
  const linked = s.commitImport({ previewId: second.previewId, recordIds: [firstKey] });
  assert.equal(linked.createdCount, 0); assert.equal(linked.linkedCount, 1); assert.equal(linked.imported[0].id, source.id);
  assert.deepEqual(s.getMemory(source.id, { tier: 'active' }), source);
  assert.deepEqual(ids(s.searchActive({ sessionId: 'second', query: 'FILE_SELECTED_SOURCE_42de' })), [source.id]);
  assert.deepEqual(s.searchActive({ sessionId: 'second', query: 'FILE_UNSELECTED_47ac' }).items, []);
  s.deleteMemory(source.id, { expectedVersion: source.version, confirmation: source.id });
  const deleted = s.previewImport({ source: 'file', targetSessionId: 'second', file });
  assert.equal(deleted.items.find(item => item.id === firstKey).status, 'blocked');
  assert.equal(deleted.items.find(item => item.id === secondKey).status, 'ready');
  conflict(() => s.commitImport({ previewId: deleted.previewId, recordIds: [secondKey, firstKey] }));
  assert.equal(s.listMemories().total, 0, 'a blocked selection prevents the entire batch and never resurrects a tombstone');
});

test('invalid and oversized files, arbitrary selections and expired previews fail without partial writes', t => {
  const h = fixture(t), s = h.scope('invalid-files'); register(s, 'target');
  const invalid = [
    { name: 'broken.json', format: 'json', content: '{"records":[' },
    { name: 'mixed.json', format: 'json', content: JSON.stringify([{ content: 'valid first row' }, { missingContent: true }]) },
    { name: '/private/path.txt', format: 'txt', content: '路径不是文件内容授权' },
    { name: 'large.txt', format: 'txt', content: '😀'.repeat(140000) },
    { name: 'script.html', format: 'html', content: '<script>doNotExecute()</script>' },
  ];
  for (const file of invalid) {
    assert.throws(() => s.previewImport({ source: 'file', targetSessionId: 'target', file }));
    assert.equal(s.listMemories().total, 0);
  }
  const file = { name: 'safe.txt', format: 'txt', content: 'FROZEN_FILE_PREVIEW_ORIGINAL' };
  const frozen = s.previewImport({ source: 'file', targetSessionId: 'target', file });
  conflict(() => s.commitImport({ previewId: frozen.previewId, recordIds: ['file:not-in-this-preview'] }));
  assert.throws(() => s.commitImport({ previewId: frozen.previewId, recordIds: selected(frozen), targetSessionId: 'other' }));
  assert.equal(s.listMemories().total, 0);
  file.content = '修改调用者对象不会替换已冻结的文件';
  const result = s.commitImport({ previewId: frozen.previewId, recordIds: selected(frozen) });
  assert.equal(s.getMemory(result.imported[0].id, { tier: 'active' }).original, 'FROZEN_FILE_PREVIEW_ORIGINAL');
  const expires = s.previewImport({ source: 'file', targetSessionId: 'target', file });
  s.clock = () => new Date(expires.expiresAt);
  conflict(() => s.commitImport({ previewId: expires.previewId, recordIds: selected(expires) }));
  assert.equal(s.listMemories().total, 1);
});
