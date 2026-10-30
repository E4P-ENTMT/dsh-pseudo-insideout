import { createHash, randomUUID } from 'node:crypto';
import { analyzeLocalTurn } from './intelligence.js';
import { parseImportFile } from './import-file.js';

const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const TTL = 10 * 60 * 1000;

/** Explicit imports only: previews hold data in memory and never grant access. */
export function installImportMethods(Service, ErrorClass) {
  const fail = (code, message, status = 400) => { throw new ErrorClass(code, message, status); };
  const text = (value, name, maximum = 200, empty = false) => {
    if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim())) fail('INVALID_IMPORT', `${name}必须为${empty ? '' : '非空'}文本，最多${maximum}字符`);
    return value;
  };
  const number = (value, fallback, maximum, minimum = 0) => {
    const parsed = value === undefined || value === null ? fallback : Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) fail('INVALID_IMPORT', '导入分页范围无效');
    return parsed;
  };
  const date = value => {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail('INVALID_IMPORT', '来源记录时间无效');
    return new Date(value).toISOString();
  };
  const strictKeys = (value, allowed) => {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('INVALID_IMPORT', '导入请求包含无效字段');
  };
  const normalizeDsh = (trusted, sessionId) => {
    if (!object(trusted) || !Array.isArray(trusted.records) || trusted.records.length > 20000) fail('IMPORT_SOURCE_UNAVAILABLE', '需要宿主重新读取完整来源会话', 409);
    if (trusted.sourceInfo?.sessionId && trusted.sourceInfo.sessionId !== sessionId || trusted.sourceInfo?.sourceSessionId && trusted.sourceInfo.sourceSessionId !== sessionId) fail('IMPORT_SOURCE_SCOPE', '宿主来源会话与所选会话不一致', 403);
    const keys = new Set(), turns = new Set();
    return trusted.records.map(record => {
      if (!object(record) || record.sourceSessionId !== sessionId) fail('IMPORT_SOURCE_SCOPE', '来源记录不属于所选会话', 403);
      const value = {
        key: text(record.key, '来源键', 500), sourceSessionId: sessionId,
        turnId: text(record.turnId, '来源回合', 200), ref: text(record.ref ?? '', '来源引用', 2000, true),
        userText: text(record.userText, '用户消息', 63990), assistantText: text(record.assistantText ?? '', '助手消息', 128000, true),
        eventAt: date(record.eventAt), sourceFingerprint: text(record.sourceFingerprint, '来源指纹', 500),
      };
      if (JSON.stringify({ user: value.userText, assistant: value.assistantText }).length > 262144) fail('IMPORT_SOURCE_TOO_LARGE', '来源回合原文过大', 413);
      if (keys.has(value.key) || turns.has(value.turnId)) fail('IMPORT_SOURCE_INVALID', '来源会话包含重复回合标识', 409);
      keys.add(value.key); turns.add(value.turnId); return value;
    });
  };

  Object.assign(Service.prototype, {
    _pruneImportPreviews() {
      for (const [key, value] of this.importPreviews) if (Date.parse(value.expiresAt) <= Date.parse(this.now())) this.importPreviews.delete(key);
    },
    _importPreview(previewId) {
      text(previewId, '预览标识'); this._pruneImportPreviews();
      const preview = this.importPreviews.get(previewId);
      if (!preview) fail('IMPORT_PREVIEW_EXPIRED', '预览已过期或来源已变化，请重新预览', 409);
      return preview;
    },
    getImportPreview(previewId) {
      const preview = this._importPreview(previewId);
      return { source: preview.source, sourceSessionId: preview.sourceSessionId, targetSessionId: preview.targetSessionId, expiresAt: preview.expiresAt };
    },
    listImportSessions({ source = 'memories', q = '', offset = 0, limit = 50 } = {}) {
      if (source !== 'memories') fail('IMPORT_SOURCE_UNAVAILABLE', '此入口只列出当前记忆空间中的会话', 400);
      text(q, '搜索词', 200, true); offset = number(offset, 0, 100000); limit = number(limit, 50, 100, 1);
      const rows = new Map(this.db.prepare('SELECT id,at FROM sessions').all().map(row => [row.id, { id: row.id, title: this._setting(`sessionMeta:${row.id}`)?.title || row.id, activeCount: 0, updatedAt: row.at }]));
      for (const memory of this._all()) {
        const sessionId = memory.source.sessionId; if (!sessionId) continue;
        if (!rows.has(sessionId)) rows.set(sessionId, { id: sessionId, title: sessionId, activeCount: 0, updatedAt: memory.updatedAt });
        const row = rows.get(sessionId); row.activeCount++; if (memory.updatedAt > row.updatedAt) row.updatedAt = memory.updatedAt;
      }
      const items = [...rows.values()].filter(row => `${row.title}\n${row.id}`.toLocaleLowerCase().includes(q.toLocaleLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { source, available: true, visibility: '当前工作区和角色的活跃记忆来源', items: items.slice(offset, offset + limit), total: items.length, offset, limit };
    },
    _importClosure(memoryId) {
      const records = new Map(), pending = [memoryId];
      while (pending.length) {
        const currentId = pending.pop(); if (records.has(currentId)) continue;
        const memory = this._raw(currentId);
        if (!memory || memory.trashedAt) fail('IMPORT_SOURCE_CHANGED', '所选记录或依赖已封存、删除或不存在，请重新选择', 409);
        records.set(currentId, memory);
        if (records.size > 2000) fail('IMPORT_DEPENDENCY_LIMIT', '所选记录的依赖超过2000条，无法完整预览', 413);
        const dependencies = [...(memory.sourceIds ?? []), ...(memory.analysisEvidenceIds ?? []), ...(memory.interpretations ?? []).flatMap(item => item.evidenceIds ?? [])];
        for (const dependency of dependencies) { text(dependency, '依赖标识'); if (!records.has(dependency)) pending.push(dependency); }
      }
      return records;
    },
    _importOrigin(node) {
      if (node.kind === 'memories') return node.id;
      if (node.kind === 'dsh') return this._captureOrigin(node.canonical.sourceSessionId, node.canonical.turnId);
      return this.db.prepare('SELECT memory FROM dedup WHERE key=?').get(node.dedupKey)?.memory ?? null;
    },
    _describeImportNode(node, targetSessionId) {
      node.memoryId = this._importOrigin(node); node.versions = {};
      let memory = null, closure = new Map();
      if (node.memoryId) {
        try { closure = this._importClosure(node.memoryId); memory = closure.get(node.memoryId); }
        catch (error) {
          if (!['IMPORT_SOURCE_CHANGED', 'IMPORT_DEPENDENCY_LIMIT'].includes(error.code)) throw error;
          return { id: node.id, title: node.input?.title || node.id, excerpt: '', eventAt: node.input?.eventAt || null, status: 'blocked', reason: error.message, memoryId: node.memoryId, dependencyCount: 0, dependencies: [] };
        }
        node.versions = Object.fromEntries([...closure].map(([id, value]) => [id, value.version]));
      }
      const dependencies = [...closure.values()].filter(value => value.id !== node.memoryId).map(value => ({ id: value.id, title: value.title }));
      const already = memory && [...closure.values()].every(value => this._visible(value, targetSessionId));
      return {
        id: node.id, title: memory?.title ?? node.input.title, excerpt: (memory?.content ?? node.input.content).slice(0, 1200), eventAt: memory?.eventAt ?? node.input.eventAt,
        status: already ? 'already' : 'ready', ...(node.memoryId ? { memoryId: node.memoryId } : {}), dependencyCount: dependencies.length, dependencies,
        ...(already ? { reason: '目标会话已可见此记录及全部依赖；不会重复复制' } : dependencies.length ? { reason: '同时授权下列完整依赖；不会共享来源会话的未来记录' } : {}),
      };
    },
    previewImport(request, trusted) {
      strictKeys(request, ['source', 'sourceSessionId', 'targetSessionId', 'memoryIds', 'file', 'offset', 'limit']);
      const source = request.source, targetSessionId = text(request.targetSessionId, '目标会话');
      if (!['memories', 'dsh', 'file'].includes(source)) fail('INVALID_IMPORT', '请选择记忆、DSH会话或文件来源');
      const offset = number(request.offset, 0, 100000), limit = number(request.limit, 200, 200, 1);
      const sourceSessionId = request.sourceSessionId === undefined ? null : text(request.sourceSessionId, '来源会话');
      let nodes = [], sourceInfo = {}, sourceSignature = null;
      if (source === 'memories') {
        if (request.file !== undefined || request.memoryIds !== undefined && sourceSessionId) fail('INVALID_IMPORT', '请选择来源会话或具体记录之一');
        let memoryIds;
        if (request.memoryIds !== undefined) {
          if (!Array.isArray(request.memoryIds) || !request.memoryIds.length || request.memoryIds.length > 200 || new Set(request.memoryIds).size !== request.memoryIds.length) fail('INVALID_IMPORT', '一次请选择1–200条不重复记忆');
          memoryIds = request.memoryIds.map(value => text(value, '记忆标识'));
        } else {
          if (!sourceSessionId) fail('INVALID_IMPORT', '请选择来源会话或记忆');
          memoryIds = this._all().filter(memory => memory.source.sessionId === sourceSessionId && !memory.trashedAt).sort((a, b) => a.eventAt.localeCompare(b.eventAt) || a.id.localeCompare(b.id)).map(memory => memory.id);
        }
        nodes = memoryIds.map(id => ({ id, kind: source }));
        sourceInfo = { source, sourceSessionId, title: sourceSessionId ? this._setting(`sessionMeta:${sourceSessionId}`)?.title || sourceSessionId : '显式选择的活跃记忆' };
      } else if (source === 'dsh') {
        if (!sourceSessionId || request.file !== undefined || request.memoryIds !== undefined) fail('INVALID_IMPORT', 'DSH导入需指定来源会话');
        const records = normalizeDsh(trusted, sourceSessionId);
        sourceInfo = clone(trusted.sourceInfo ?? { sourceSessionId }); sourceSignature = trusted.sourceSignature ?? null;
        nodes = records.map(canonical => {
          const local = analyzeLocalTurn(canonical.userText, { now: canonical.eventAt, timeZone: this.getConfig().timeZone });
          const input = { ...local, title: canonical.userText.trim().slice(0, 60), content: `用户陈述：${canonical.userText}`, original: JSON.stringify({ user: canonical.userText, assistant: canonical.assistantText }), eventAt: canonical.eventAt, source: { type: 'import', sessionId: canonical.sourceSessionId, turnId: canonical.turnId, ref: canonical.ref }, visibility: 'session', subject: 'user', extraction: { method: 'local-rules', reason: local.reason ?? '从用户明确选择的历史回合保守提炼' } };
          return { id: canonical.key, kind: source, canonical, canonicalHash: hash(canonical), input, dedupKey: this._captureKey(canonical.sourceSessionId, canonical.turnId), origin: { kind: 'dsh', sourceSessionId, turnId: canonical.turnId, key: canonical.key, ref: canonical.ref, sourceFingerprint: canonical.sourceFingerprint } };
        });
      } else {
        if (sourceSessionId || request.memoryIds !== undefined) fail('INVALID_IMPORT', '文件导入只接受文件与目标会话');
        let parsed;
        try { parsed = parseImportFile(request.file); }
        catch (error) { fail('INVALID_IMPORT_FILE', error.message); }
        sourceInfo = parsed.sourceInfo; sourceSignature = parsed.sourceSignature;
        nodes = parsed.entries.map(entry => {
          const metadata = entry.metadata;
          if (metadata.fictional !== undefined && typeof metadata.fictional !== 'boolean') fail('INVALID_IMPORT_FILE', 'fictional字段必须为布尔值');
          const input = { ...metadata, title: typeof metadata.title === 'string' ? metadata.title.slice(0, 160) : request.file.name.slice(0, 160), content: entry.content, original: entry.original, eventAt: metadata.eventAt ?? this.now(), source: { type: 'import', sessionId: targetSessionId, ref: request.file.name }, visibility: 'session', subject: 'world', extraction: { method: 'file-import', reason: '用户明确选择导入；文件元数据是来源声明，未经核验' } };
          return { id: entry.key, kind: source, canonical: entry, canonicalHash: hash(entry), input, dedupKey: `import:file:${sourceInfo.fileHash}:${entry.key}`, origin: { kind: 'file', name: sourceInfo.name, format: sourceInfo.format, fileHash: sourceInfo.fileHash, key: entry.key } };
        });
      }
      const total = nodes.length; nodes = nodes.slice(offset, offset + limit);
      for (const node of nodes) if (node.input) this._makeMemory(node.input);
      const items = nodes.map(node => { const item = this._describeImportNode(node, targetSessionId); node.status = item.status; return item; });
      const previewId = `import_${randomUUID()}`, expiresAt = new Date(Date.parse(this.now()) + TTL).toISOString();
      this._pruneImportPreviews(); while (this.importPreviews.size >= 10) this.importPreviews.delete(this.importPreviews.keys().next().value);
      this.importPreviews.set(previewId, { source, sourceSessionId, targetSessionId, expiresAt, sourceSignature, nodes: new Map(nodes.map(node => [node.id, node])) });
      return { previewId, source, sourceSessionId, targetSessionId, expiresAt, items, total, offset, limit, hasMore: offset + items.length < total, sourceInfo, targetPolicy: this.getSessionMemory({ sessionId: targetSessionId }), notice: '仅在确认后处理所选记录与已显示的依赖；不会更改目标会话的记忆开关，也不会自动纳入未来内容。' };
    },
    commitImport(request, trusted) {
      strictKeys(request, ['previewId', 'recordIds']);
      const preview = this._importPreview(request.previewId);
      if (!Array.isArray(request.recordIds) || !request.recordIds.length || request.recordIds.length > 200 || new Set(request.recordIds).size !== request.recordIds.length) fail('INVALID_IMPORT', '请选择1–200条不重复预览记录');
      const nodes = request.recordIds.map(recordId => { text(recordId, '记录标识', 500); const node = preview.nodes.get(recordId); if (!node || node.status === 'blocked') fail('IMPORT_SELECTION_INVALID', '所选记录不属于此预览或不可导入', 409); return node; });
      if (preview.source === 'dsh') {
        const current = new Map(normalizeDsh(trusted, preview.sourceSessionId).map(record => [record.key, record]));
        for (const node of nodes) if (!current.has(node.id) || hash(current.get(node.id)) !== node.canonicalHash) fail('IMPORT_SOURCE_CHANGED', '选中的来源回合已变化，请重新预览', 409);
      }
      const resolved = new Map();
      const result = this._tx(() => {
        const plans = nodes.map(node => {
          const origin = this._importOrigin(node), expected = node.committedMemoryId ?? node.memoryId;
          if (origin !== expected) fail('IMPORT_SOURCE_CHANGED', '来源记录状态已变化，请重新预览', 409);
          const closure = origin ? this._importClosure(origin) : new Map();
          if (origin) {
            const versions = node.committedVersions ?? node.versions;
            if (closure.size !== Object.keys(versions).length || [...closure].some(([id, memory]) => versions[id] !== memory.version)) fail('IMPORT_SOURCE_CHANGED', '所选记录或依赖版本已变化，请重新预览', 409);
          } else this._makeMemory(node.input);
          return { node, closure, origin, requiresChange: !origin || [...closure.values()].some(memory => !this._visible(memory, preview.targetSessionId)) };
        });
        const imported = new Map(), skipped = [];
        let createdCount = 0, linkedCount = 0;
        for (const plan of plans) {
          let memory;
          if (!plan.origin) {
            memory = this.createMemory(plan.node.input, { idempotencyKey: plan.node.dedupKey });
            memory.importOrigin = { ...plan.node.origin, importedAt: this.now() }; this._save(memory);
            plan.closure.set(memory.id, memory); plan.origin = memory.id; createdCount++;
            imported.set(memory.id, { id: memory.id, title: memory.title, created: true });
          }
          for (const entry of plan.closure.values()) {
            if (this._visible(entry, preview.targetSessionId)) continue;
            const linked = this.db.prepare('INSERT OR IGNORE INTO import_access(memory,session,at) VALUES (?,?,?)').run(entry.id, preview.targetSessionId, this.now());
            if (linked.changes) { linkedCount++; if (!imported.has(entry.id)) imported.set(entry.id, { id: entry.id, title: entry.title, created: false }); }
          }
          if (!plan.requiresChange) skipped.push({ id: plan.node.id, reason: '目标会话已可见此记录及全部依赖' });
          resolved.set(plan.node.id, { committedMemoryId: plan.origin, committedVersions: Object.fromEntries([...plan.closure].map(([id, memory]) => [id, memory.version])) });
        }
        this.registerSession({ sessionId: preview.targetSessionId });
        this._log('imports.committed', [...imported.keys()], { source: preview.source, targetSessionId: preview.targetSessionId, createdCount, linkedCount, skippedCount: skipped.length });
        this.cache.clear();
        return { targetSessionId: preview.targetSessionId, imported: [...imported.values()], skipped, createdCount, linkedCount, skippedCount: skipped.length };
      });
      for (const [id, value] of resolved) Object.assign(preview.nodes.get(id), value);
      return result;
    },
  });
}
