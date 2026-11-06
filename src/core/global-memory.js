// Federated, read-only recall over the known spaces of one profile. Bodies and
// indexes stay in their owning store; no global database or implicit imports.
const scopedId = (scopeId, memoryId) => `global:${scopeId}:${memoryId}`;

export class GlobalMemoryRegistry {
  constructor(defaults) { this.defaults = defaults; this.services = new Map(); }
  register(service) {
    if (service.defaults !== this.defaults || !service.runtime.scopeId || service.runtime.workspaceId === '(unbound)') throw new Error('Global memory requires a bound space in the same profile');
    this.services.set(service.runtime.scopeId, service);
    return () => { if (this.services.get(service.runtime.scopeId) === service) this.services.delete(service.runtime.scopeId); };
  }
  stamp(target) {
    const policy = this.defaults.getSharing();
    if (!policy.enabled) return `off:${policy.version}`;
    // Triggers observe edits from all connections without invalidating other
    // sessions merely because a source wrote a recall log or refreshed its index.
    return JSON.stringify([policy.version, this.defaults.get().version, ...[...this.services].filter(([, service]) => service !== target).map(([id, service]) => [id,
      service.db.prepare('SELECT version FROM recall_revision WHERE id=1').get().version])]);
  }
  _eligible(service, memory, sessions = new Map()) {
    if (!memory || memory.visibility !== 'workspace' || memory.fictional || memory.trashedAt || !service.getConfig().enabled) return false;
    const enabled = sessionId => {
      if (!sessions.has(sessionId)) sessions.set(sessionId, sessionId ? service.memoryEnabled(sessionId) : service.getMemoryDefault().enabled);
      return sessions.get(sessionId);
    };
    if (!enabled(memory.source.sessionId)) return false;
    return service._evidenceValid(service._memoryEvidenceIds(memory), undefined, { shared: true, lookup: id => {
      const source = service._raw(id);
      return source && enabled(source.source.sessionId) ? source : null;
    } });
  }
  _reference(service, memory) {
    const scopeId = service.runtime.scopeId;
    return { ...memory, id: scopedId(scopeId, memory.id), sourceIds: memory.sourceIds.map(id => scopedId(scopeId, id)),
      globalOrigin: { scopeId, memoryId: memory.id, workspaceId: service.runtime.workspaceId, agentId: service.runtime.agentId } };
  }
  list(target) {
    if (!this.defaults.getSharing().enabled) return [];
    const result = [];
    for (const service of this.services.values()) {
      if (service === target || !service.getConfig().enabled) continue;
      const sessions = new Map();
      for (const memory of service._all()) if (this._eligible(service, memory, sessions)) result.push(this._reference(service, memory));
    }
    return result;
  }
  resolve(target, id) {
    if (!this.defaults.getSharing().enabled || typeof id !== 'string') return null;
    const match = /^global:([^:]+):([^:]+)$/.exec(id);
    const service = match && this.services.get(match[1]);
    if (!service || service === target) return null;
    try {
      const memory = service._raw(match[2]);
      return this._eligible(service, memory) ? this._reference(service, memory) : null;
    } catch (error) { if (error.code === 'CORRUPT_RECORD') return null; throw error; }
  }
}
