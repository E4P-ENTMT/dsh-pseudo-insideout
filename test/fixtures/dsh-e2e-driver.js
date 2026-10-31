// Test-only driver for the official DSH registry and loop. Never shipped in npm files.
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const name = 'insideout-synthetic-driver'
export const inject = ['agents', 'webServer', 'tools', 'sessions', 'sessionQuery']
export async function apply(ctx, config) {
  // 0.2.1 executes native calls inside ToolsService; 0.2.2 moved that code
  // into a separate executor package. Load it only for that host API.
  const NativeToolExecutor = typeof ctx.tools.setExecutor === 'function'
    ? (await import('@deepseek-ai/dsh-tool-executor-native')).NativeToolExecutor
    : null
  const handles = new Map(), events = new Map()
  const token = Buffer.from(config.token)
  ctx.on('session/event', (session, event) => {
    if (session.id.startsWith('insideout-e2e-')) {
      const list = events.get(session.id) || []
      list.push(event)
      events.set(session.id, list)
    }
  })
  ctx.effect(() => async () => { await Promise.allSettled([...handles.values()].map(handle => handle.dispose())) })
  const ensureAgent = async (sessionId, space) => {
    if (!handles.has(sessionId)) handles.set(sessionId, await ctx.agents.create({ sessionId, meta: { cwd: space === 'secondary' ? join(config.workspace, 'secondary') : config.workspace }, agentOptions: { provider: 'insideout-synthetic', model: 'insideout-test-model', maxTokens: 2000 }, setup(agentCtx) {
      if (NativeToolExecutor) agentCtx.tools.setExecutor(new NativeToolExecutor(agentCtx))
      else agentCtx.tools.presentAs('native')
    } }))
    return handles.get(sessionId).agent
  }
  const handler = async (req, res) => {
    const supplied = Buffer.from(typeof req.headers['x-test-token'] === 'string' ? req.headers['x-test-token'] : '')
    if (req.method !== 'POST' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || supplied.length !== token.length || !timingSafeEqual(supplied, token)) { res.writeHead(403); return res.end() }
    try {
      let raw = ''; for await (const part of req) { raw += part; if (raw.length > 10000) throw new Error('body too large') }
      const { sessionId, text, action, space } = JSON.parse(raw)
      if (!/^insideout-e2e-[a-z0-9-]+$/.test(sessionId) || ![undefined, 'primary', 'secondary'].includes(space)) throw new Error('invalid synthetic input')
      if (req.url === '/__insideout_e2e__/session') {
        if (action === 'create') await ensureAgent(sessionId, space)
        else if (action === 'detach') {
          const handle = handles.get(sessionId)
          if (handle) { await handle.agent.whenIdle(); await ctx.sessions.flush(handle.agent.session); await handle.dispose(); handles.delete(sessionId) }
        } else if (action !== 'inspect') throw new Error('invalid synthetic session action')
        const snapshot = await ctx.sessionQuery.readSession(sessionId)
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ sessionId, live: Boolean(ctx.sessions.get(sessionId)), header: snapshot.session, eventCount: snapshot.events.length, digest: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') }))
      }
      if (typeof text !== 'string' || text.length > 4000) throw new Error('invalid synthetic input')
      const agent = await ensureAgent(sessionId, space)
      await agent.whenIdle()
      const start = events.get(sessionId)?.length || 0
      agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
      await agent.whenIdle()
      await ctx.sessions.flush(agent.session)
      const latest = (events.get(sessionId) || []).slice(start)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ sessionId, events: latest, requestId: randomUUID() }))
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: error.message }))
    }
  }
  for (const path of ['/__insideout_e2e__/turn', '/__insideout_e2e__/session']) ctx.webServer.register({ kind: 'exact', path, handler })
}
