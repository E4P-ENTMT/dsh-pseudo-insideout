import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const MAX_SESSIONS = 2000
const MAX_EVENTS = 20000
const MAX_BYTES = 16 * 1024 * 1024
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = message => Array.isArray(message?.content) ? message.content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n') : ''
const fail = (code, message, status = 400) => { throw Object.assign(new Error(message), { code, status, public: true }) }
const identifier = value => {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\x00-\x1f\\/]/.test(value)) fail('INVALID_SESSION', '会话标识无效。')
  return value
}
const pageNumber = (value, fallback, max, minimum = 0) => {
  const number = value === undefined || value === null ? fallback : Number(value)
  if (!Number.isSafeInteger(number) || number < minimum || number > max) fail('INVALID_PAGE', '分页范围无效。')
  return number
}
function scopeOf(header) {
  return { workspaceId: header?.cwd ? resolve(header.cwd) : '(no-workspace)', agentId: header?.agentPreset || 'default' }
}
function inScope(header, runtime) {
  const scope = scopeOf(header)
  return header && header.origin !== 'subagent' && scope.workspaceId === runtime.workspaceId && scope.agentId === runtime.agentId
}
function capability(query) {
  return query && ['listSessions', 'readTitleSnapshots', 'readSession', 'readSurface'].every(key => typeof query[key] === 'function')
}
const unavailable = () => ({ available: false, source: 'dsh', reason: '当前宿主未提供完整的只读会话查询接口，无法浏览或导入历史会话。' })
function boundedLog(snapshot, sourceSessionId, runtime) {
  if (!snapshot || snapshot.session?.id !== sourceSessionId || !inScope(snapshot.session, runtime)) fail('IMPORT_SOURCE_SCOPE', '来源会话不在当前工作区和角色范围内。', 403)
  if (!Array.isArray(snapshot.events) || !Number.isSafeInteger(snapshot.inheritedEventCount) || snapshot.inheritedEventCount < 0 || snapshot.inheritedEventCount > snapshot.events.length) fail('IMPORT_SOURCE_INVALID', '宿主返回的会话记录不完整。', 409)
  if (snapshot.events.length > MAX_EVENTS) fail('IMPORT_SOURCE_TOO_LARGE', `来源超过 ${MAX_EVENTS} 个事件，无法安全预览；请先选择较小的会话。`, 413)
  const serialized = JSON.stringify(snapshot)
  if (Buffer.byteLength(serialized) > MAX_BYTES) fail('IMPORT_SOURCE_TOO_LARGE', '来源会话超过 16 MiB，无法安全预览；请先选择较小的会话。', 413)
  if (snapshot.events.some((event, index) => event?.seq !== index)) fail('IMPORT_SOURCE_INVALID', '宿主返回的会话事件序列不完整。', 409)
  return hash(snapshot)
}

/** Public read-only host APIs; no resume, append, persistence path or source mutation. */
export async function readDshImportSource(query, sourceSessionId, runtime) {
  identifier(sourceSessionId)
  if (!capability(query)) fail('IMPORT_SOURCE_UNAVAILABLE', unavailable().reason, 503)
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = await query.readSession(sourceSessionId)
    const signature = boundedLog(snapshot, sourceSessionId, runtime)
    const surface = await query.readSurface(sourceSessionId)
    const verified = await query.readSession(sourceSessionId)
    if (boundedLog(verified, sourceSessionId, runtime) !== signature || hash(surface?.session) !== hash(snapshot.session) || surface.inheritedEventCount !== snapshot.inheritedEventCount || surface.capturedThroughSeq !== (snapshot.events.at(-1)?.seq ?? null)) continue
    if (!Array.isArray(surface.events) || surface.events.length > MAX_EVENTS) fail('IMPORT_SOURCE_INVALID', '宿主返回的有效会话内容无效。', 409)
    const current = new Map()
    for (const event of surface.events) {
      if (!event || current.has(event.seq) || hash(event) !== hash(snapshot.events[event.seq])) fail('IMPORT_SOURCE_CHANGED', '来源会话在读取期间变化，请重新预览。', 409)
      current.set(event.seq, event)
    }
    const skipped = { inheritedEvents: snapshot.inheritedEventCount, shadowedMessages: 0, replacementMessages: 0, nonHumanMessages: 0, interruptedMessages: 0, failedTurns: 0, incompleteTurns: 0, emptyTurns: 0, oversizedTurns: 0 }
    const records = []
    let turn = null, title = sourceSessionId
    for (const event of snapshot.events) {
      if (event.type === 'session/title' && typeof event.data?.title === 'string') title = event.data.title.slice(0, 300)
      if (event.seq < snapshot.inheritedEventCount) continue
      const data = event.data
      if (event.type === 'turn/start') {
        if (turn) skipped.incompleteTurns++
        turn = { id: data?.turn, start: event.seq, users: new Map(), assistants: [], seqs: [] }
        continue
      }
      if (event.type === 'turn/end') {
        if (!turn || data?.turn !== turn.id) continue
        const completed = turn
        turn = null
        if (data.reason?.kind !== 'completed') { skipped.failedTurns++; continue }
        const userText = [...completed.users.values()].join('\n'), assistantText = completed.assistants.join('\n')
        if (!userText.trim()) { skipped.emptyTurns++; continue }
        if (userText.length > 63990 || assistantText.length > 128000 || JSON.stringify({ user: userText, assistant: assistantText }).length > 262144) { skipped.oversizedTurns++; continue }
        if (!Number.isFinite(event.time)) fail('IMPORT_SOURCE_INVALID', '来源回合缺少有效完成时间。', 409)
        const key = `dsh:${sourceSessionId}:${event.seq}`
        const record = { key, userText, assistantText, eventAt: new Date(event.time).toISOString(), sourceSessionId, turnId: String(completed.id), ref: `dsh-session:${encodeURIComponent(sourceSessionId)}#event=${event.seq}` }
        record.sourceFingerprint = hash({ header: snapshot.session, inheritedEventCount: snapshot.inheritedEventCount, start: completed.start, end: event.seq, seqs: completed.seqs, record })
        records.push(record)
        continue
      }
      if (!['user/message', 'assistant/message'].includes(event.type)) continue
      if (!current.has(event.seq)) { skipped.shadowedMessages++; continue }
      if (event.surfaceOp !== 'append') { skipped.replacementMessages++; continue }
      if (!turn) continue
      if (event.type === 'user/message') {
        if (data?.source?.kind !== 'user') { skipped.nonHumanMessages++; continue }
        const value = text(data)
        if (value.trim()) { turn.users.set(data.id || event.seq, value); turn.seqs.push(event.seq) }
      } else {
        if (data?.interrupted) { skipped.interruptedMessages++; continue }
        if (data?.turn !== turn.id) continue
        const value = text(data.message)
        if (value.trim()) { turn.assistants.push(value); turn.seqs.push(event.seq) }
      }
    }
    if (turn) skipped.incompleteTurns++
    return { records, sourceSignature: hash({ header: snapshot.session, inheritedEventCount: snapshot.inheritedEventCount, records: records.map(record => [record.key, record.sourceFingerprint]) }), sourceInfo: { source: 'dsh', sourceSessionId, title, ...scopeOf(snapshot.session), createdAt: snapshot.session.createdAt, visibility: '当前宿主可见；按当前工作区和角色筛选', capturedThroughSeq: snapshot.events.at(-1)?.seq ?? null, skipped, skippedOversize: skipped.oversizedTurns } }
  }
  fail('IMPORT_SOURCE_CHANGED', '来源会话在读取期间持续变化，请稍后重新预览。', 409)
}

/** Extension only owns DSH imports; core retains memory and file import routes. */
export function createSessionImportExtension({ getSessions }) {
  return async ({ service, method, path, body, query }) => {
    try {
      const runtime = service.runtime || service.state().runtime
      if (method === 'GET' && path === '/imports/sessions' && query.get('source') === 'dsh') {
        const host = getSessions()
        if (!capability(host)) return { status: 200, body: unavailable() }
        const offset = pageNumber(query.get('offset'), 0, MAX_SESSIONS), limit = pageNumber(query.get('limit'), 50, 100, 1)
        const q = query.get('q') || ''
        if (q.length > 200) fail('INVALID_QUERY', '会话搜索词过长。')
        const listed = await host.listSessions()
        if (!Array.isArray(listed) || listed.length > MAX_SESSIONS) fail('IMPORT_CATALOG_TOO_LARGE', `宿主可见会话超过 ${MAX_SESSIONS} 条，暂不能完整列出。`, 413)
        const scoped = listed.filter(row => inScope(row.header, runtime))
        const titles = await host.readTitleSnapshots(scoped.map(row => row.header.id))
        const byId = new Map(titles.map(row => [row.sessionId, row]))
        const items = scoped.map(({ header }) => {
          const result = byId.get(header.id)
          if (result?.status !== 'fulfilled' || result.value?.session?.id !== header.id || !inScope(result.value.session, runtime)) fail('IMPORT_TITLE_UNAVAILABLE', '部分会话标题无法读取，请稍后重试。', 503)
          return { id: header.id, title: result.value.title?.title || header.id, createdAt: header.createdAt, ...scopeOf(header) }
        }).filter(item => `${item.title}\n${item.id}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
        return { status: 200, body: { available: true, source: 'dsh', visibility: '当前宿主可见；按当前工作区和角色筛选', items: items.slice(offset, offset + limit), total: items.length, offset, limit } }
      }
      if (method === 'POST' && path === '/imports/preview' && body?.source === 'dsh') {
        if (!object(body) || Object.keys(body).some(key => !['source', 'sourceSessionId', 'targetSessionId', 'offset', 'limit'].includes(key))) fail('INVALID_IMPORT', '导入预览只接受来源会话、目标会话和分页信息。')
        identifier(body.sourceSessionId); identifier(body.targetSessionId)
        const offset = pageNumber(body.offset, 0, MAX_EVENTS), limit = pageNumber(body.limit, 200, 200, 1)
        const source = await readDshImportSource(getSessions(), body.sourceSessionId, runtime)
        return { status: 200, body: service.previewImport({ ...body, offset, limit }, source) }
      }
      if (method === 'POST' && path === '/imports/commit' && object(body)) {
        const preview = service.getImportPreview(body.previewId)
        if (preview.source !== 'dsh') return undefined
        const source = await readDshImportSource(getSessions(), preview.sourceSessionId, runtime)
        return { status: 200, body: service.commitImport(body, source) }
      }
      return undefined
    } catch (error) {
      if (error.public || (typeof error.code === 'string' && Number.isInteger(error.status))) return { status: error.status, body: { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } } }
      return { status: 503, body: { error: { code: 'IMPORT_SOURCE_UNAVAILABLE', message: '宿主会话暂时无法读取，尚未确认导入成功。请稍后重试。' } } }
    }
  }
}
