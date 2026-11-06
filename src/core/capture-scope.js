// The former capture default made every completed turn session-private.
// Upgrade only proven, unedited automatic records in the active store. Never
// open the archive, infer consent from record text, or alter manual/import scope.
export function migrateCapturedMemoryScope(service, evidenceHash) {
  if (service._setting('captureScopeMigration') === 1) return;
  service._tx(() => {
    if (service._setting('captureScopeMigration') === 1) return;
    const storedConfig = service._setting('config');
    // An explicit capture policy belongs to the user, including opt-in privacy.
    if (!Object.hasOwn(storedConfig, 'captureVisibility')) {
      const all = service._all(), byId = new Map(all.map(memory => [memory.id, memory]));
      const captured = new Set(service.db.prepare("SELECT memory FROM dedup WHERE key LIKE 'capture:%'").all().map(row => row.memory));
      for (const row of service.db.prepare("SELECT targets FROM logs WHERE action='turn.captured'").iterate()) {
        try { const ids = JSON.parse(row.targets); if (Array.isArray(ids)) for (const id of ids) captured.add(id); } catch {}
      }
      const candidates = new Set(all.filter(memory => captured.has(memory.id) && memory.visibility === 'session'
        && memory.source.type === 'user' && memory.source.sessionId && memory.source.turnId
        && !memory.fictional && !memory.trashedAt && !memory.importOrigin && !memory.revisions.length && !memory.interpretations.length
        && ['host-model', 'local-rules', 'local-rules-after-invalidation'].includes(memory.extraction?.method)).map(memory => memory.id));
      // Validate the complete prospective closure together; model captures often
      // reference earlier captures which are being promoted in this same batch.
      let changed = true;
      while (changed) {
        changed = false;
        for (const id of candidates) {
          if (!service._evidenceValid(service._memoryEvidenceIds(byId.get(id)), undefined, { shared: true, lookup: key => {
            const source = byId.get(key);
            return source && candidates.has(key) ? { ...source, visibility: 'workspace' } : source;
          } })) { candidates.delete(id); changed = true; }
        }
      }
      const promoted = new Map();
      for (const id of candidates) {
        const memory = byId.get(id);
        const before = { version: memory.version, evidence: evidenceHash(memory), source: service._sourceFingerprint(memory), analysis: service._analysisFingerprint(memory) };
        service._revise(memory, '升级：自动记忆默认供同一工作区与角色的会话使用');
        memory.revisions.at(-1).author = 'system'; memory.visibility = 'workspace';
        promoted.set(id, { before, after: { version: memory.version, evidence: evidenceHash(memory), source: service._sourceFingerprint(memory), analysis: service._analysisFingerprint(memory) } });
      }
      // Scope widening preserves evidence text. Rebase only proofs that matched
      // the exact old source; stale proofs must stay stale. Archived histories
      // remain untouched and keep their original disclosure boundary.
      const rebase = (map, field) => {
        let changed = false;
        for (const [id, value] of Object.entries(map ?? {})) {
          const proof = promoted.get(id);
          if (proof && value === proof.before[field]) { map[id] = proof.after[field]; changed = true; }
        }
        return changed;
      };
      if (promoted.size) {
        for (const memory of all) {
          let changed = promoted.has(memory.id);
          changed = rebase(memory.evidenceHashes, 'evidence') || changed;
          changed = rebase(memory.analysisEvidenceVersions, 'version') || changed;
          changed = rebase(memory.analysisEvidenceFingerprints, 'analysis') || changed;
          for (const interpretation of memory.interpretations) changed = rebase(interpretation.evidenceHashes, 'evidence') || changed;
          if (changed) service._save(memory);
        }
        const islandVersions = new Map();
        for (const table of ['islands', 'dreams']) for (const row of service.db.prepare(`SELECT id,data FROM ${table}`).all()) {
          const item = JSON.parse(row.data);
          let changed = rebase(item.evidenceVersions, 'version');
          changed = rebase(item.analysisEvidenceVersions, 'version') || changed;
          changed = rebase(item.sourceFingerprints, 'source') || changed;
          const islandVersion = islandVersions.get(item.payload?.islandId);
          if (islandVersion !== undefined && item.payload.islandVersion === islandVersion) { item.payload.islandVersion++; changed = true; }
          if (changed) {
            if (table === 'islands') islandVersions.set(item.id, item.version);
            item.version++; service.db.prepare(`UPDATE ${table} SET data=? WHERE id=?`).run(JSON.stringify(item), row.id);
          }
        }
        service.cache.clear();
        service._log('memory.capture-scope-migrated', [...promoted.keys()], { count: promoted.size, visibility: 'workspace' });
      }
      service._setting('config', { ...storedConfig, captureVisibility: 'workspace' });
      service._setting('scopePolicyVersion', (service._setting('scopePolicyVersion') ?? 0) + 1);
    }
    service._setting('captureScopeMigration', 1);
  });
}
