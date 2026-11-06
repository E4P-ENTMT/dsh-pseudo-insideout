// Decode before any consumer uses arrays, dates or nested evidence. Invalid
// records are excluded without rewriting their original database bytes.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string';
const texts = value => Array.isArray(value) && value.every(text);
const date = value => text(value) && Number.isFinite(Date.parse(value));
const optional = (value, check) => value == null || check(value);
const unit = value => Number.isFinite(value) && value >= 0 && value <= 1;
const map = (value, check) => object(value) && Object.values(value).every(check);

export function validStoredMemory(m, id) {
  if (!object(m) || m.id !== id || !Number.isInteger(m.version) || m.version < 1
    || !['active', 'archive'].includes(m.tier) || !['episode', 'fact', 'preference', 'commitment', 'reflection'].includes(m.kind)
    || !['session', 'workspace'].includes(m.visibility) || !optional(m.subject, v => ['user', 'agent', 'world'].includes(v))
    || ![m.title, m.content, m.original].every(text) || ![m.eventAt, m.createdAt, m.updatedAt].every(date)
    || !unit(m.importance) || typeof m.core !== 'boolean' || typeof m.fictional !== 'boolean'
    || !object(m.source) || !['user', 'observed', 'assistant', 'import', 'model'].includes(m.source.type)
    || ![m.source.sessionId, m.source.turnId, m.source.ref].every(text) || (m.visibility === 'session' && !m.source.sessionId)
    || ![m.tags, m.entities, m.sourceIds].every(texts) || !optional(m.semanticKeys, texts)
    || !object(m.emotions) || !['joy', 'sadness', 'fear', 'anger', 'disgust', 'curiosity'].every(k => unit(m.emotions[k]))
    || !Array.isArray(m.interpretations) || !m.interpretations.every(v => object(v) && text(v.text) && texts(v.evidenceIds))
    || !Array.isArray(m.revisions) || !m.revisions.every(object)
    || !optional(m.analysisEvidenceIds, texts) || !optional(m.analysisEvidenceVersions, v => map(v, Number.isInteger))
    || !optional(m.analysisEvidenceFingerprints, v => map(v, text)) || !optional(m.evidenceHashes, v => map(v, text))
    || !optional(m.dueAt, date) || !optional(m.archivedAt, date) || !optional(m.trashedAt, date)
    || !optional(m.profileFacet, v => ['preference', 'relationship', 'habit', 'value', 'interest'].includes(v))
    || !optional(m.extraction, v => object(v) && text(v.method) && text(v.reason))
    || !optional(m.importOrigin, object) || !optional(m.manualMetadata, object)) return false;
  return true;
}
