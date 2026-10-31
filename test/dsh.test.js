import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createServer, request as httpRequest } from 'node:http'
import vm from 'node:vm'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolsService from '@deepseek-ai/dsh-tools'
import * as NativeTools from '@deepseek-ai/dsh-tool-executor-native'
import { createScope, scopeTarget } from '@deepseek-ai/dsh-scope'
import * as plugin from '../src/dsh/host.js'
import { InsideOutService } from '../src/core/service.js'
import { MemoryDefaults } from '../src/core/policy.js'
import { readDshImportSource, createSessionImportExtension } from '../src/dsh/session-import.js'

const settle = () => new Promise(resolve => setImmediate(resolve))
const message = (id, text, kind = 'user') => ({ id, role: 'user', source: { kind }, content: [{ type: 'text', text }] })

async function harness(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'insideout-dsh-'))
  const ctx = new Context()
  const services = []
  const agents = []
  const routes = new Map()
  ctx.provide('profileContext', { name: 'test-profile', dir: join(dir, 'profile'), home: dir })
  ctx.provide('agents', { roots: () => agents })
  ctx.provide('webServer', { register(route) { assert.ok(!routes.has(route.path)); routes.set(route.path, route); return () => routes.delete(route.path) } })
  if (options.llm) ctx.provide('llm', options.llm)
  if (options.sessionQuery) ctx.provide('sessionQuery', options.sessionQuery)
  await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false })
  await ctx.plugin(ToolsService)
  await ctx.plugin(NativeTools)
  const fiber = await ctx.plugin(plugin, { analyzeTurns: false, ...options.config, dataDir: join(dir, 'memory'), serviceFactory(args) {
    const service = new InsideOutService(args)
    services.push(service)
    return service
  } })
  t.after(async () => { await fiber.dispose(); await ctx.fiber.dispose(); await rm(dir, { recursive: true, force: true }) })
  async function agent(id = 'session-1', cwd = '/workspace/a', preset = 'default', origin) {
    const a = { session: { id, header: { id, cwd, agentPreset: preset, origin } }, model: { current: () => ({ provider: 'test', model: 'model' }) } }
    const scope = createScope(ctx, a)
    a.ctx = scope.ctx
    options.configureAgent?.(a)
    agents.push(a)
    t.after(() => scope.dispose())
    await ctx.serial(scopeTarget(a, a), 'agent/created', { agent: a, source: 'create' })
    return a
  }
  function emit(a, type, data, seq = 1) {
    ctx.emit(scopeTarget(a.session, a), 'session/event', a.session, { type, data, seq, time: Date.now() })
  }
  async function preStep(a, turn, messages, signal = new AbortController().signal) {
    return ctx.waterfall(scopeTarget(a, a), 'agent/pre-step', { agent: a, turn, step: 1, messages, signal }, async () => ({ kind: 'enter', messages }))
  }
  return { dir, ctx, fiber, services, routes, agents, agent, emit, preStep }
}

test('real Cordis + official DSH scoped SystemPrompt: capture completed turns once and clean up', async t => {
  const h = await harness(t)
  assert.equal(h.routes.size, 2)
  assert.equal(h.services[0].state().runtime.connected, false)
  const a = await h.agent()
  const service = h.services.find(s => s.state().runtime.connected)
  assert.ok(service)
  const input = message('u1', '我今天第一次去海边散步。')
  h.emit(a, 'turn/start', { turn: 1 })
  await h.preStep(a, 1, [input])
  h.emit(a, 'user/message', input)
  h.emit(a, 'user/message', message('context-1', '这不是用户说的秘密', 'context'))
  h.emit(a, 'assistant/message', { turn: 1, step: 1, message: { content: [{ type: 'reasoning', text: '不该保存的推理' }, { type: 'text', text: '海边的风让人放松。' }] } })
  await h.ctx.serial(scopeTarget(a, a), 'agent/turn-stopping', { agent: a, turn: 1, signal: new AbortController().signal })
  assert.equal(service.listMemories({}).total, 0, 'stopping is not final commit')
  h.emit(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
  h.emit(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
  await settle()
  const stored = service.listMemories({}).items
  assert.equal(stored.length, 1)
  assert.match(stored[0].original, /海边的风/)
  assert.doesNotMatch(stored[0].original, /推理|秘密/)
  assert.equal(stored[0].source.turnId, '1')
  await h.fiber.dispose()
  assert.equal(h.routes.size, 0)
  const assembly = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  assert.ok(!assembly.contexts.some(v => v.name === 'dsh-pseudo-insideout'))
})

test('pre-step read source, repeated prompt assembly and archive invalidation form a closed loop', async t => {
  const h = await harness(t)
  const a = await h.agent()
  const s = h.services.find(x => x.state().runtime.connected)
  const m = s.createMemory({ title: '海边散步', content: '喜欢去海边散步 {{literal}}', source: { type: 'user', sessionId: a.session.id }, importance: 0.8 })
  await h.preStep(a, 2, [message('u2', '还记得海边散步吗')])
  const before = s.listLogs({ limit: 100 }).items.length
  const first = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  const second = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  const text = first.contexts.find(v => v.name === 'dsh-pseudo-insideout').text
  assert.match(text, /海边/)
  assert.match(text, /\{\{literal\}\}/)
  assert.equal(second.contexts.find(v => v.name === 'dsh-pseudo-insideout').text, text)
  assert.equal(s.listLogs({ limit: 100 }).items.length, before, 'provider has no write side effects')
  s.archiveMemory(m.id, { expectedVersion: m.version, reason: '测试封存' })
  const after = h.ctx.systemPrompt.refreshContext(second, { scope: a, agent: a })
  assert.ok(!after.contexts.some(v => v.name === 'dsh-pseudo-insideout' && v.text.includes('海边')))
})

test('failed turns and subagents are excluded; workspace/preset separate services and persistence survives detach', async t => {
  const h = await harness(t)
  const a = await h.agent('session-a', '/workspace/a', 'assistant')
  const b = await h.agent('session-b', '/workspace/b', 'assistant')
  const c = await h.agent('session-c', '/workspace/a', 'different')
  await h.agent('child', '/workspace/a', 'assistant', 'subagent')
  assert.equal(h.services.length, 4, 'unbound + 3 isolated scopes, no child scope')
  h.emit(a, 'turn/start', { turn: 1 })
  h.emit(a, 'user/message', message('failed-user', '失败回合不应捕获'))
  h.emit(a, 'turn/end', { turn: 1, reason: { kind: 'error' } })
  await settle()
  assert.equal(h.services.reduce((n, s) => n + s.listMemories({}).total, 0), 0)
  const scopeA = h.services.find(s => s.state().runtime.workspaceId === '/workspace/a' && s.state().runtime.agentId === 'assistant')
  const memory = scopeA.createMemory({ title: '仅A空间', content: 'A独有资料', source: { type: 'user', sessionId: a.session.id } })
  await h.preStep(b, 2, [message('ub', 'A独有资料')])
  const assembly = await h.ctx.systemPrompt.assemble({ scope: b, agent: b })
  assert.ok(!assembly.contexts.some(v => v.text.includes('A独有资料')))
  h.ctx.emit(scopeTarget(a, a), 'agent/disposed', { agent: a })
  assert.equal(scopeA.state().runtime.connected, false)
  assert.equal(scopeA.getMemory(memory.id, { tier: 'active' }).content, 'A独有资料')
  assert.ok(c)
})

test('unloading drains already completed raw turns even if an auxiliary provider ignores abort', async t => {
  const waiting = { stream: async function* () { await new Promise(() => {}); yield { type: 'text-delta', text: '{}' } } }
  const h = await harness(t, { llm: waiting, config: { analyzeTurns: true } })
  const a = await h.agent()
  const s = h.services.find(x => x.state().runtime.connected)
  let captured
  const originalComplete = s.completeTurn.bind(s)
  s.completeTurn = input => { captured = input; return originalComplete(input) }
  h.emit(a, 'turn/start', { turn: 1 })
  h.emit(a, 'user/message', message('u1', '不能因插件卸载丢掉已经完成的经历'))
  h.emit(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
  await settle()
  await h.fiber.dispose()
  assert.match(captured.userText, /已经完成/)
  assert.equal(captured.analysis, undefined)
})

test('loopback HTTP requires token and same origin, blocks Host spoofing and static traversal', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'insideout-http-'))
  const webRoot = join(dir, 'web')
  await mkdir(webRoot)
  await writeFile(join(webRoot, 'index.html'), '<!doctype html><script>window.boot=__INSIDEOUT_BOOT__</script><script src="app.js"></script>')
  await writeFile(join(webRoot, 'app.js'), 'document.title="test"')
  await writeFile(join(webRoot, 'styles.css'), 'body{color:white}')
  const service = new InsideOutService({ dataDir: join(dir, 'data') })
  const token = 'a'.repeat(64)
  const server = createServer(plugin.createHttpHandler({ getService: () => service, token, webRoot, mode: 'standalone' }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(async () => { await new Promise(resolve => server.close(resolve)); service.close(); await rm(dir, { recursive: true, force: true }) })
  const page = await fetch(`${base}/pseudo-insideout/`)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /"apiBase":"\/api\/pseudo-insideout\/v1"/)
  assert.match(page.headers.get('content-security-policy'), /nonce-/)
  const api = `${base}${plugin.API_BASE}/state`
  assert.equal((await fetch(api)).status, 401)
  assert.equal((await fetch(api, { headers: { 'x-insideout-token': token, origin: 'http://evil.example' } })).status, 403)
  const spoofed = await new Promise((resolve, reject) => {
    const request = httpRequest(api, { headers: { 'x-insideout-token': token, host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode) })
    request.on('error', reject); request.end()
  })
  assert.equal(spoofed, 403)
  assert.equal((await fetch(api, { headers: { 'x-insideout-token': token, 'sec-fetch-site': 'cross-site' } })).status, 403)
  const ok = await fetch(api, { headers: { 'x-insideout-token': token, origin: base, 'x-forwarded-for': '203.0.113.4' } })
  assert.equal(ok.status, 200, 'forwarded headers are ignored; socket is the trust boundary')
  assert.equal((await fetch(`${base}/pseudo-insideout/%2e%2e/package.json`)).status, 404)
  assert.equal((await fetch(`${base}/pseudo-insideout/package.json`)).status, 404)
  assert.equal((await fetch(`${base}${plugin.API_BASE}/memories`, { method: 'POST', headers: { 'x-insideout-token': token, 'content-type': 'application/json' }, body: '{not-json' })).status, 400)
  const headers = { 'x-insideout-token': token, 'content-type': 'application/json' }
  const content = '\t'.repeat(512 * 1024 - 1) + 'x'
  const importBody = value => JSON.stringify({ source: 'file', targetSessionId: 'http-file-target', file: { name: 'escaped.txt', format: 'txt', content: value } })
  const escaped = importBody(content)
  assert.equal(Buffer.byteLength(content, 'utf8'), 512 * 1024)
  assert.ok(Buffer.byteLength(escaped, 'utf8') > 1024 * 1024, 'JSON escaping exceeds the ordinary transport ceiling for a valid file')
  const preview = await fetch(`${base}${plugin.API_BASE}/imports/preview`, { method: 'POST', headers, body: escaped })
  assert.equal(preview.status, 200)
  const candidate = await preview.json()
  assert.equal(candidate.sourceInfo.bytes, 512 * 1024)
  assert.ok(candidate.items.length > 1 && candidate.items.every(item => item.status === 'ready'))
  const oversized = await fetch(`${base}${plugin.API_BASE}/imports/preview`, { method: 'POST', headers, body: importBody(content + '\t') })
  assert.equal(oversized.status, 400)
  assert.equal((await oversized.json()).error.code, 'INVALID_IMPORT_FILE')
  assert.equal((await fetch(`${base}${plugin.API_BASE}/memories`, { method: 'POST', headers, body: escaped })).status, 413, 'other endpoints retain their original transport ceiling')
  assert.equal(service.listMemories().total, 0, 'accepted previews and rejected uploads do not write records')
})

test('DSH client factory registers a real settings section with same-origin iframe', async () => {
  let bundle
  vm.runInNewContext(await readFile(new URL('../src/dsh/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load(value) { bundle = value } } } })
  assert.equal(bundle.id, 'dsh-pseudo-insideout')
  const React = { createElement: (type, props, ...children) => ({ type, props, children }) }
  const client = bundle.factory(name => { assert.equal(name, 'react'); return React })
  let registration
  client.apply({ slots: { inject(name, callback) { assert.equal(name, 'settings.section'); callback() }, register(options, component) { registration = { options, component }; return () => {} } } })
  assert.equal(registration.options.name, 'settings.section')
  const view = registration.component()
  assert.equal(view.children[0].type, 'iframe')
  assert.equal(view.children[0].props.src, '/pseudo-insideout/')
})

test('structured emotion analysis consumes text deltas only and validates bounded values', async () => {
  const values = Object.fromEntries(['joy', 'sadness', 'fear', 'anger', 'disgust', 'curiosity'].map(k => [k, 0.4]))
  const llm = { stream: async function* () {
    yield { type: 'reasoning-delta', text: 'private reasoning' }
    yield { type: 'text-delta', text: JSON.stringify({ emotions: values, confidence: 0.8, reason: '本轮有明确证据' }) }
  } }
  const analyzed = await plugin.analyzeTurn(llm, { provider: 'test', model: 'model' }, { sessionId: 's', userText: '今天开心', assistantText: '收到' })
  assert.equal(analyzed.confidence, 0.8)
  assert.equal(analyzed.emotions.joy, 0.4)
  const invalid = { stream: async function* () { yield { type: 'text-delta', text: JSON.stringify({ emotions: { ...values, joy: 2 }, confidence: 1, reason: '' }) } } }
  await assert.rejects(plugin.analyzeTurn(invalid, { provider: 'test', model: 'model' }, { sessionId: 's', userText: '', assistantText: '' }))
})

test('temporary archive disclosure is confined to one newly injected turn and does not restore activity', async t => {
  const h = await harness(t)
  const a = await h.agent()
  const s = h.services.find(x => x.state().runtime.connected)
  const memory = s.createMemory({ title: '旧旅行', content: '曾经在江南雨中旅行', source: { type: 'user', sessionId: a.session.id } })
  s.archiveMemory(memory.id, { expectedVersion: memory.version, reason: '独立封存' })
  s.requestRecall(memory.id, { sessionId: a.session.id })
  await h.preStep(a, 1, [message('u1', '调阅旧旅行')])
  const once = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  assert.ok(once.contexts.some(v => v.text.includes('江南雨中')))
  await h.preStep(a, 2, [message('u2', '继续说旅行')])
  const next = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  assert.ok(!next.contexts.some(v => v.text.includes('江南雨中')))
  assert.equal(s.listMemories({ tier: 'active' }).total, 0)
  assert.equal(s.getMemory(memory.id, { tier: 'archive' }).tier, 'archive')
})

test('known memory scopes remain browsable after plugin restart with no active agents', async t => {
  const h = await harness(t)
  const a = await h.agent()
  const s = h.services.find(x => x.state().runtime.connected)
  const memory = s.createMemory({ title: '重启后保留', content: '原有工作空间的记忆', source: { type: 'user', sessionId: a.session.id } })
  const id = s.state().runtime.scopeId
  h.ctx.emit(scopeTarget(a, a), 'agent/disposed', { agent: a })
  h.agents.length = 0
  await h.fiber.restart()
  const reopened = h.services.at(-2)
  assert.equal(reopened.state().runtime.scopeId, id)
  assert.equal(reopened.state().runtime.connected, false)
  assert.equal(reopened.getMemory(memory.id, { tier: 'active' }).content, memory.content)
})

test('remote socket cannot gain access by supplying forwarded loopback headers', async () => {
  let status
  let body
  const handler = plugin.createHttpHandler({ getService: () => { throw new Error('must not resolve service') }, token: 'x' })
  await handler({ url: `${plugin.API_BASE}/state`, method: 'GET', headers: { host: 'localhost', 'x-forwarded-for': '127.0.0.1', 'x-insideout-token': 'x' }, socket: { remoteAddress: '203.0.113.9' } }, {
    writeHead(value) { status = value }, end(value) { body = value },
  })
  assert.equal(status, 403)
  assert.match(body, /local-only/)
})

const extractedMemory = overrides => ({ kind: 'preference', importance: 0.92, tags: ['表达偏好'], entities: [], fictional: false, dueAt: null, profileFacet: 'preference', semanticKeys: ['简洁'], reason: '用户明确陈述了稳定偏好', ...overrides })
const jsonModel = response => ({ stream: async function* (request) {
  const value = typeof response === 'function' ? response(request) : response
  yield { type: 'text-delta', text: JSON.stringify(value) }
} })

test('structured growth analysis uses bounded active evidence and authoritative memory/island versions', async () => {
  const context = { items: [
    { id: 'known', version: 4, content: '我希望回答简洁', tier: 'active', subject: 'world', sourceType: 'import', sourceNotice: '外部文件参考；文件内身份及事实声明未经核验' },
    { id: 'archived', version: 8, content: '封存秘密', tier: 'archive' },
    { id: 'fiction', version: 1, content: '角色扮演', fictional: true },
  ], islands: [{ id: 'island-known', version: 3, title: '旧岛标题', description: 'ISLAND_PROSE_PRIVATE_MARKER_4812', facet: 'preference', evidenceIds: ['known'] }] }
  const value = { confidence: 0.9, reason: '同一偏好重复出现', memory: extractedMemory(), evidenceVersions: { known: 999 }, islandVersions: { 'island-known': 999 }, proposals: [{ type: 'island', title: '简洁交流', description: '来自重复陈述', evidenceIds: ['known', '$current'], payload: { title: '简洁交流', description: '用户多次说明希望简洁', facet: 'preference', islandId: 'island-known' } }] }
  const model = jsonModel(request => {
    const input = JSON.parse(request.messages[0].content[0].text)
    assert.deepEqual(input.background.items.map(v => v.id), ['known'])
    assert.equal(input.background.items[0].subject, 'world')
    assert.equal(input.background.items[0].sourceType, 'import')
    assert.match(input.background.items[0].sourceNotice, /外部文件.*未经核验/)
    assert.deepEqual(input.background.islands, [{ id: 'island-known', version: 3, subject: 'user', evidenceIds: ['known'] }])
    assert.ok(!JSON.stringify(request).includes('ISLAND_PROSE_PRIVATE_MARKER_4812'))
    assert.equal(request.maxTokens, 3000)
    return value
  })
  const result = await plugin.analyzeTurn(model, { provider: 'test', model: 'model' }, { sessionId: 's', userText: '仍然希望简洁', context })
  assert.deepEqual(result.evidenceVersions, { known: 4 })
  assert.deepEqual(result.islandVersions, { 'island-known': 3 })
  assert.equal(result.memory.profileFacet, 'preference')
  await assert.rejects(plugin.analyzeTurn(jsonModel({ ...value, proposals: [{ ...value.proposals[0], evidenceIds: ['archived', '$current'] }] }), { provider: 'test', model: 'model' }, { sessionId: 's', context }))
  await assert.rejects(plugin.analyzeTurn(jsonModel({ ...value, memory: extractedMemory({ dueAt: '2026-02-30' }) }), { provider: 'test', model: 'model' }, { sessionId: 's', context }))
  await assert.rejects(plugin.analyzeTurn(jsonModel({ ...value, proposals: [{ ...value.proposals[0], payload: { ...value.proposals[0].payload, islandId: 'invented' } }] }), { provider: 'test', model: 'model' }, { sessionId: 's', context }))
})

test('ordinary completed turns receive structured memory and pending proposals even when mood is disabled', async t => {
  let evidenceId, calls = 0, seen
  const llm = { stream: async function* (request) {
    calls++; seen = request
    yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } }
    yield { type: 'text-delta', text: JSON.stringify({ confidence: 0.9, reason: '重复表达偏好', memory: extractedMemory(), proposals: [{ type: 'summary', title: '简洁表达的持续偏好', description: '两轮都明确提到简洁', evidenceIds: [evidenceId, '$current'], payload: { content: '用户偏好简洁的表达。' } }] }) }
    yield { type: 'usage', usage: { inputTokens: 30, outputTokens: 20, cacheReadTokens: 10, cacheWriteTokens: 5 } }
  } }
  const h = await harness(t, { llm, config: { analyzeTurns: true } })
  const a = await h.agent()
  const s = h.services.find(v => v.state().runtime.connected)
  s.updateConfig({ moodEnabled: false, dreamEnabled: true })
  evidenceId = s.createMemory({ title: '先前偏好', content: '用户希望回答简洁', source: { type: 'user', sessionId: a.session.id } }).id
  h.emit(a, 'turn/start', { turn: 11 })
  h.emit(a, 'user/message', message('u11', '我一直希望你把回答写得简洁一些。'))
  h.emit(a, 'assistant/message', { turn: 11, message: { content: [{ type: 'text', text: '我记下这个表达偏好。 ASSISTANT_PRIVATE_MARKER_3917' }] } })
  h.emit(a, 'turn/end', { turn: 11, reason: { kind: 'completed' } })
  await settle()
  const captured = s.listMemories({}).items.find(v => v.source.turnId === '11')
  assert.equal(captured.kind, 'preference')
  assert.equal(captured.extraction.method, 'host-model')
  assert.equal(captured.importance, 0.92)
  assert.match(captured.original, /我一直希望/)
  assert.match(captured.original, /ASSISTANT_PRIVATE_MARKER_3917/)
  assert.ok(!JSON.stringify(seen).includes('ASSISTANT_PRIVATE_MARKER_3917'), 'assistant paraphrases never enter auxiliary analysis without evidence lineage')
  assert.equal(calls, 1)
  assert.match(seen.system, /情绪更新已关闭/)
  const proposal = s.listDreams().items.find(v => v.title === '简洁表达的持续偏好')
  assert.ok(proposal)
  assert.ok(proposal.evidenceIds.includes(captured.id))
  assert.equal(proposal.status, 'pending')
  await h.preStep(a, 11, [])
  const usage = s.listRecalls({ sessionId: a.session.id }).items.find(v => v.turnId === '11').usage
  assert.equal(usage.length, 1)
  assert.equal(usage[0].inputTokens, 30, 'usage chunks are snapshots, not accumulated deltas')
  assert.equal(usage[0].inputTotalTokens, 45)
  assert.equal(usage[0].purpose, 'turn-analysis')
})

test('invalid auxiliary output retains raw completed turn and records failure usage', async t => {
  const h = await harness(t, { llm: jsonModel({ confidence: 1, reason: 'invalid', memory: extractedMemory({ importance: 9 }) }), config: { analyzeTurns: true } })
  const a = await h.agent()
  const s = h.services.find(v => v.state().runtime.connected)
  h.emit(a, 'turn/start', { turn: 8 })
  h.emit(a, 'user/message', message('u8', '我今天路过公园。'))
  h.emit(a, 'turn/end', { turn: 8, reason: { kind: 'completed' } })
  await settle()
  const memory = s.listMemories({}).items[0]
  assert.match(memory.original, /路过公园/)
  assert.equal(memory.extraction.method, 'local-rules')
  await h.preStep(a, 8, [])
  assert.equal(s.listRecalls({ sessionId: a.session.id }).items[0].usage[0].status, 'error')
})

test('semantic recall calls the host once per turn and rejects stale or out-of-scope model evidence', async t => {
  let target, calls = 0, mutate
  const llm = jsonModel(request => {
    calls++
    assert.equal(request.maxTokens, 1200)
    const input = JSON.parse(request.messages[0].content[0].text)
    assert.ok(input.candidates.some(v => v.id === target))
    assert.ok(!JSON.stringify(input).includes('隔离秘密'))
    mutate?.()
    return { semanticHits: [{ id: target, score: 0.99, reason: '同一经历的另一种表述' }] }
  })
  const h = await harness(t, { llm })
  const a = await h.agent()
  const s = h.services.find(v => v.state().runtime.connected)
  target = s.createMemory({ title: '天文经历', content: '凌晨在山上看到了猎户座。', source: { type: 'user', sessionId: a.session.id } }).id
  s.createMemory({ title: '私有', content: '隔离秘密', source: { type: 'user', sessionId: 'another' } })
  await h.preStep(a, 1, [message('u1', '回想那次夜空旅行')])
  await h.preStep(a, 1, [message('u1', '回想那次夜空旅行')])
  assert.equal(calls, 1)
  assert.ok(s.peekContext({ sessionId: a.session.id, turnId: '1' }).items.some(v => v.id === target))
  const m = s.getMemory(target, { tier: 'active' })
  mutate = () => s.updateMemory(target, { expectedVersion: m.version, content: '今天换了台灯', title: '换灯', reason: '更正' })
  await h.preStep(a, 2, [message('u2', '回想那次夜空旅行')])
  assert.equal(calls, 2)
  assert.ok(!s.peekContext({ sessionId: a.session.id, turnId: '2' }).items.some(v => v.id === target))
  s.updateConfig({ semanticEnabled: false })
  await h.preStep(a, 3, [message('u3', '再想想')])
  assert.equal(calls, 2)
})

test('legacy hosts use the current assembled model for recall and completed request for analysis, isolated per agent', async t => {
  const selections = new Map(), headers = new Map(), requests = []
  const h = await harness(t, { config: { analyzeTurns: true }, configureAgent(a) {
    delete a.model
    a.options = { provider: 'initial', model: 'initial' }
    a.session.requestHeader = () => ({ config: headers.get(a.session.id) })
    // Emulate 0.2.1 installModelSelection, installed before plugin mount.
    a.ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const assembled = await next()
      return { ...assembled, variables: { ...assembled.variables, ...selections.get(a.session.id) } }
    })
  }, llm: jsonModel(request => {
    requests.push({ session: request.sessionId, turn: request.turnId, provider: request.provider, model: request.model, purpose: request.maxTokens === 1200 ? 'recall' : 'analysis' })
    return request.maxTokens === 1200 ? { semanticHits: [] } : { confidence: 0.9, reason: '旧宿主提炼', memory: extractedMemory() }
  }) })
  const a = await h.agent('legacy-a'), b = await h.agent('legacy-b')
  const service = h.services.find(value => value.state().runtime.connected)
  for (const agent of [a, b]) service.createMemory({ content: '简洁表达', source: { type: 'user', sessionId: agent.session.id } })
  headers.set(a.session.id, { provider: 'previous', model: 'previous' })
  selections.set(a.session.id, { provider: 'selected-a', model: 'a-one' })
  h.emit(a, 'turn/start', { turn: 1 })
  await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  selections.get(a.session.id).model = 'not-assembled-yet'
  await h.preStep(a, 1, [message('a1', '简洁表达')])
  h.emit(a, 'user/message', message('a1', '我偏好简洁表达'))
  headers.set(a.session.id, { provider: 'actual-a', model: 'completed-a' })
  h.emit(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
  headers.get(a.session.id).model = 'changed-after-turn'
  await settle()
  assert.ok(service.listMemories({}).items.some(item => item.extraction?.method === 'host-model'))

  selections.set(a.session.id, { provider: 'switched-a', model: 'a-two' })
  selections.set(b.session.id, { provider: 'selected-b', model: 'b-one' })
  h.emit(a, 'turn/start', { turn: 2 }); h.emit(b, 'turn/start', { turn: 1 })
  await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  await h.ctx.systemPrompt.assemble({ scope: b, agent: b })
  await h.preStep(a, 2, [message('a2', '简洁表达')])
  await h.preStep(b, 1, [message('b1', '简洁表达')])
  assert.deepEqual(requests, [
    { session: 'legacy-a', turn: '1', provider: 'selected-a', model: 'a-one', purpose: 'recall' },
    { session: 'legacy-a', turn: '1', provider: 'actual-a', model: 'completed-a', purpose: 'analysis' },
    { session: 'legacy-a', turn: '2', provider: 'switched-a', model: 'a-two', purpose: 'recall' },
    { session: 'legacy-b', turn: '1', provider: 'selected-b', model: 'b-one', purpose: 'recall' },
  ])
})

test('legacy recall falls back only without selection variables and clears invalid or unassembled routes', async t => {
  let variables = {}, header, calls = []
  const h = await harness(t, { configureAgent(a) {
    delete a.model
    a.options = { provider: 'configured', model: 'initial' }
    a.session.requestHeader = () => header
    a.ctx.on('system-prompt/assemble', async (_assembly, _context, next) => ({ ...await next(), variables }))
  }, llm: jsonModel(request => { calls.push(request.model); return { semanticHits: [] } }) })
  const a = await h.agent(), s = h.services.find(value => value.state().runtime.connected)
  s.createMemory({ content: '检索候选', source: { type: 'user', sessionId: a.session.id } })
  for (let turn = 1; turn <= 5; turn++) {
    h.emit(a, 'turn/start', { turn })
    if (turn === 2) header = { config: { provider: 'actual', model: 'last-request' } }
    if (turn === 3) header = { config: { provider: 'configured', model: 'initial' } }
    if (turn === 4) variables = { provider: 'incomplete-selection' }
    if (turn !== 5) await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
    await h.preStep(a, turn, [message(`u${turn}`, '检索候选')])
  }
  assert.deepEqual(calls, ['initial', 'initial'], 'a conflicting historical header cannot route recall to a previous provider')
})

test('modern model selection and pre-step snapshots take priority over legacy routes', async t => {
  const calls = []
  let selected = { provider: 'modern', model: 'current' }
  const h = await harness(t, { config: { analyzeTurns: true }, configureAgent(a) {
    a.model.current = () => selected
    a.options = { provider: 'old', model: 'options' }
    a.session.requestHeader = () => ({ config: { provider: 'old', model: 'header' } })
    a.ctx.on('system-prompt/assemble', async (_assembly, _context, next) => ({ ...await next(), variables: { provider: 'old', model: 'assembled' } }))
  }, llm: jsonModel(request => {
    calls.push(request.model)
    return request.maxTokens === 1200 ? { semanticHits: [] } : { confidence: 0.9, reason: '现代宿主', memory: extractedMemory() }
  }) })
  const a = await h.agent(), s = h.services.find(value => value.state().runtime.connected)
  s.createMemory({ content: '检索候选', source: { type: 'user', sessionId: a.session.id } })
  await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  await h.preStep(a, 1, [message('u1', '检索候选')])
  await h.ctx.waterfall(scopeTarget(a, a), 'agent/pre-step', { agent: a, turn: 2, step: 1, messages: [message('u2', '检索候选')], signal: new AbortController().signal, modelSelection: { provider: 'modern', model: 'step-snapshot' } }, async () => ({ kind: 'enter', messages: [] }))
  h.emit(a, 'turn/start', { turn: 3 })
  h.emit(a, 'user/message', message('u3', '现代模型提炼'))
  h.emit(a, 'turn/end', { turn: 3, reason: { kind: 'completed' } })
  await settle()
  selected = undefined
  await h.preStep(a, 4, [message('u4', '检索候选')])
  assert.deepEqual(calls, ['current', 'step-snapshot', 'current'])
})

test('semantic query validation rejects invented IDs and handles date bounds with usage on failure', async () => {
  const context = { items: [{ id: 'm1', version: 2, content: '与小林散步', tier: 'active' }] }
  const usage = []
  const request = { sessionId: 's', turnId: '1', query: '10月30日和小林的事', context }
  const plan = await plugin.planRecall(jsonModel({ from: '2026-10-30', to: '2026-10-30', entity: '小林', semanticHits: [{ id: 'm1', score: 0.8, reason: '日期和人物匹配' }] }), { provider: 'test', model: 'model' }, request)
  assert.equal(plan.from, '2026-10-30T00:00:00.000Z')
  assert.equal(plan.to, '2026-10-31T00:00:00.000Z')
  assert.deepEqual(plan.evidenceVersions, { m1: 2 })
  await assert.rejects(plugin.planRecall(jsonModel({ semanticHits: [{ id: 'other-session', score: 1, reason: '未知ID' }] }), { provider: 'test', model: 'model' }, request, undefined, { onUsage: value => usage.push(value) }))
  assert.equal(usage[0].status, 'error')
  assert.equal(usage[0].purpose, 'semantic-recall')
  const delayed = { stream: async function* () { await new Promise(resolve => setTimeout(resolve, 25)); yield { type: 'text-delta', text: '{}' } } }
  await assert.rejects(plugin.planRecall(delayed, { provider: 'test', model: 'model' }, request, undefined, { timeoutMs: 5, onUsage: value => usage.push(value) }))
  assert.equal(usage[1].status, 'timeout')
})

test('official native executor runs scoped read-only memory tool without consuming archive authorization', async t => {
  const h = await harness(t)
  const a = await h.agent(), b = await h.agent('another')
  const s = h.services.find(v => v.state().runtime.connected)
  const source = { type: 'user', sessionId: a.session.id }
  const active = s.createMemory({ title: '活跃记忆', content: '活跃海边旅行', source, entities: ['小林'] })
  const archived = s.createMemory({ title: '封存记忆', content: '独立档案秘密', source })
  s.archiveMemory(archived.id, { expectedVersion: archived.version, reason: '封存' })
  s.requestRecall(archived.id, { sessionId: a.session.id })
  s.createMemory({ title: '别的会话', content: '另一会话私有秘密', source: { type: 'user', sessionId: b.session.id } })
  assert.equal(h.ctx.tools.get('insideout_search_memory'), undefined, 'scoped tool is absent from global registry')
  const call = async (agent, args) => (await h.ctx.tools.execute({ agent, signal: new AbortController().signal, calls: [{ type: 'tool-call', id: 'call-1', name: 'insideout_search_memory', arguments: JSON.stringify(args) }] })).results[0].result
  const result = await call(a, { query: '', limit: 10, maxChars: 8000 })
  assert.equal(result.isError, false)
  assert.deepEqual(result.value.items.map(v => v.id), [active.id])
  assert.ok(result.content[0].text.includes('活跃海边旅行'))
  assert.ok(!(await call(b, { query: '' })).value.items.some(v => v.id === active.id))
  const file = s.previewImport({ source: 'file', targetSessionId: a.session.id, file: { name: 'claims.json', format: 'json', content: JSON.stringify({ content: 'FILE_TOOL_PROVENANCE_73ac', kind: 'fact', subject: 'user' }) } })
  s.commitImport({ previewId: file.previewId, recordIds: file.items.map(item => item.id) })
  const fileTool = await call(a, { query: 'FILE_TOOL_PROVENANCE_73ac' })
  assert.equal(fileTool.isError, false)
  const fileItem = fileTool.value.items.find(item => item.content === 'FILE_TOOL_PROVENANCE_73ac')
  assert.ok(fileItem); assert.equal(fileItem.subject, 'world'); assert.equal(fileItem.sourceType, 'import')
  assert.match(fileItem.sourceNotice, /外部文件.*未经核验/)
  assert.equal((await call(a, { tier: 'archive' })).isError, true)
  assert.equal((await call(a, { limit: 1000 })).isError, true)
  await h.preStep(a, 4, [message('u4', '调阅')])
  assert.ok(s.peekContext({ sessionId: a.session.id, turnId: '4' }).items.some(v => v.id === archived.id), 'read-only tool did not consume the explicit one-turn archive grant')
  h.ctx.emit(scopeTarget(a, a), 'agent/disposed', { agent: a })
  assert.equal(h.ctx.tools.get('insideout_search_memory', a), undefined)
  assert.equal((await call(a, {})).isError, true)
})

test('minute maintenance visits each known scope and stops on plugin disposal', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const h = await harness(t)
  await h.agent('a', '/scope/a'); await h.agent('b', '/scope/b')
  let ticks = 0
  for (const service of h.services.filter(v => v.state().runtime.connected)) service.tick = () => { ticks++ }
  t.mock.timers.tick(60000)
  assert.equal(ticks, 2)
  await h.fiber.dispose()
  t.mock.timers.tick(120000)
  assert.equal(ticks, 2)
})

test('cancelled pre-step aborts semantic provider work, records status, and does not inject context', async t => {
  let started
  const ready = new Promise(resolve => { started = resolve })
  const llm = { stream: async function* (request) {
    started()
    await new Promise(resolve => request.signal.addEventListener('abort', resolve, { once: true }))
    yield { type: 'text-delta', text: '{"semanticHits":[]}' }
  } }
  const h = await harness(t, { llm })
  const a = await h.agent(), s = h.services.find(v => v.state().runtime.connected)
  s.createMemory({ title: '候选', content: '取消测试候选', source: { type: 'user', sessionId: a.session.id } })
  const recorded = [], recordUsage = s.recordModelUsage.bind(s)
  s.recordModelUsage = value => { recorded.push(value); return recordUsage(value) }
  const cancellation = new AbortController()
  const pending = h.preStep(a, 1, [message('cancel-user', '测试候选')], cancellation.signal)
  await ready
  cancellation.abort()
  await pending
  assert.equal(recorded.length, 1)
  assert.equal(recorded[0].status, 'aborted')
  assert.equal(recorded[0].purpose, 'semantic-recall')
  const prompt = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  assert.ok(!prompt.contexts.some(v => v.name === 'dsh-pseudo-insideout' && v.text.includes('取消测试候选')))
})

const policy = (service, sessionId, override) => service.updateSessionMemory({ sessionId, expectedVersion: service.getSessionMemory({ sessionId }).version, override })
const defaultPolicy = (service, enabled) => service.updateMemoryDefault({ expectedVersion: service.getMemoryDefault().version, enabled })
const complete = (h, agent, turn, input) => {
  h.emit(agent, 'turn/start', { turn })
  h.emit(agent, 'user/message', message(`u${turn}`, input))
  h.emit(agent, 'turn/end', { turn, reason: { kind: 'completed' } })
}

test('profile memory default is shared across scopes, registers muted sessions and persists across restart', async t => {
  const h = await harness(t)
  const a = await h.agent('first', '/scope/first')
  const first = h.services.find(service => service.state().runtime.workspaceId === '/scope/first')
  defaultPolicy(first, false)
  const b = await h.agent('second', '/scope/second')
  const second = h.services.find(service => service.state().runtime.workspaceId === '/scope/second')
  assert.equal(second.getSessionMemory({ sessionId: b.session.id }).effectiveEnabled, false)
  complete(h, b, 1, '关闭时不应捕获')
  await settle()
  assert.equal(second.listMemories({}).total, 0)
  policy(second, b.session.id, 'on')
  assert.equal(second.memoryEnabled(b.session.id), true)
  assert.equal(first.memoryEnabled(a.session.id), false)
  h.ctx.emit(scopeTarget(a, a), 'agent/disposed', { agent: a })
  h.ctx.emit(scopeTarget(b, b), 'agent/disposed', { agent: b })
  h.agents.length = 0
  await h.fiber.restart()
  const latest = h.services.at(-1)
  assert.equal(latest.getMemoryDefault().enabled, false)
})

test('off then on during a turn clears capture and recall until the next complete turn', async t => {
  let calls = 0
  const h = await harness(t, { llm: jsonModel(() => { calls++; return { semanticHits: [] } }) })
  const a = await h.agent(), s = h.services.find(service => service.state().runtime.connected)
  s.createMemory({ title: '旧参考', content: '旧参考私有正文', source: { type: 'user', sessionId: a.session.id } })
  h.emit(a, 'turn/start', { turn: 1 })
  h.emit(a, 'user/message', message('before-off', '关闭前内容不能在重开后捕获'))
  policy(s, a.session.id, 'off')
  policy(s, a.session.id, 'on')
  await h.preStep(a, 1, [message('after-on', '旧参考')])
  h.emit(a, 'user/message', message('after-on', '重开同轮内容也不能捕获'))
  h.emit(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
  await settle()
  assert.equal(calls, 0)
  assert.equal(s.listMemories({}).total, 1)
  const prompt = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  assert.ok(!prompt.contexts.some(value => value.name === 'dsh-pseudo-insideout' && value.text.includes('旧参考私有正文')))
  complete(h, a, 2, '这是重新开启之后的完整新回合')
  await settle()
  assert.equal(s.listMemories({}).total, 2)
})

test('policy changes abort in-flight auxiliary work and cannot revive its result', async t => {
  let started, signal
  const ready = new Promise(resolve => { started = resolve })
  const h = await harness(t, { llm: { stream: async function* (request) {
    signal = request.signal; started()
    await new Promise(resolve => request.signal.addEventListener('abort', resolve, { once: true }))
    yield { type: 'text-delta', text: JSON.stringify({ confidence: 0.9, reason: '旧结果', memory: extractedMemory() }) }
  } }, config: { analyzeTurns: true } })
  const a = await h.agent(), s = h.services.find(service => service.state().runtime.connected)
  complete(h, a, 1, '等待分析时关闭不能保存这段内容')
  await ready
  defaultPolicy(s, false)
  assert.equal(signal.aborted, true)
  defaultPolicy(s, true)
  await settle()
  assert.equal(s.listMemories({}).total, 0)
})

test('explicit session on remains active while the profile default changes', async t => {
  let started, finish, signal
  const ready = new Promise(resolve => { started = resolve }), release = new Promise(resolve => { finish = resolve })
  const h = await harness(t, { llm: { stream: async function* (request) {
    signal = request.signal; started(); await release
    yield { type: 'text-delta', text: JSON.stringify({ confidence: 0.9, reason: '独立开启', memory: extractedMemory() }) }
  } }, config: { analyzeTurns: true } })
  const a = await h.agent(), s = h.services.find(service => service.state().runtime.connected)
  policy(s, a.session.id, 'on')
  complete(h, a, 1, '本会话明确开启，应当继续保存完整回合')
  await ready
  defaultPolicy(s, false)
  assert.equal(signal.aborted, false)
  finish(); await settle()
  assert.equal(s.listMemories({}).total, 1)
})

test('closing memory during semantic recall aborts the provider and keeps the reopened turn empty', async t => {
  let started, calls = 0, signal
  const ready = new Promise(resolve => { started = resolve })
  const h = await harness(t, { llm: { stream: async function* (request) {
    signal = request.signal; calls++; started()
    await new Promise(resolve => request.signal.addEventListener('abort', resolve, { once: true }))
    yield { type: 'text-delta', text: '{"semanticHits":[]}' }
  } } })
  const a = await h.agent(), s = h.services.find(service => service.state().runtime.connected)
  s.createMemory({ title: '取消候选', content: '取消后不可再次注入的旧候选', source: { type: 'user', sessionId: a.session.id } })
  const pending = h.preStep(a, 1, [message('candidate', '旧候选')])
  await ready
  s.updateConfig({ enabled: false })
  s.updateConfig({ enabled: true })
  await pending
  await h.preStep(a, 1, [message('candidate2', '旧候选')])
  assert.equal(signal.aborted, true)
  assert.equal(calls, 1)
  assert.equal(s.peekContext({ sessionId: a.session.id, turnId: '1' }), null)
  const prompt = await h.ctx.systemPrompt.assemble({ scope: a, agent: a })
  assert.ok(!prompt.contexts.some(value => value.name === 'dsh-pseudo-insideout' && value.text.includes('旧候选')))
})

test('independent profile connections cannot revive prompt, tools or delayed analysis within a toggled turn', async t => {
  let started, finish, calls = 0, pendingSignal
  const ready = new Promise(resolve => { started = resolve }), release = new Promise(resolve => { finish = resolve })
  const h = await harness(t, { llm: { stream: async function* (request) {
    calls++
    if (calls === 1) { pendingSignal = request.signal; started(); await release }
    yield { type: 'text-delta', text: JSON.stringify({ confidence: 0.9, reason: '独立连接后返回的分析', emotions: { joy: 0.6 }, memory: extractedMemory() }) }
  } }, config: { analyzeTurns: true } })
  const a = await h.agent(), s = h.services.find(service => service.state().runtime.connected)
  s.updateConfig({ semanticEnabled: false })
  const existing = s.createMemory({ title: '跨连接参考', content: 'EXTERNAL_POLICY_PRIVATE_76ac', source: { type: 'user', sessionId: a.session.id } })
  const external = new MemoryDefaults({ dataDir: dirname(s.dataDir), scope: 'profile' })
  let notifications = 0
  const unsubscribe = s.onMemoryPolicyChange(() => { notifications++ })
  const toggleExternally = () => {
    external.update({ expectedVersion: external.get().version, enabled: false })
    external.update({ expectedVersion: external.get().version, enabled: true })
  }
  const call = async () => (await h.ctx.tools.execute({ agent: a, signal: new AbortController().signal, calls: [{ type: 'tool-call', id: 'external-policy-call', name: 'insideout_search_memory', arguments: JSON.stringify({ query: 'EXTERNAL_POLICY_PRIVATE_76ac' }) }] })).results[0].result
  const context = async () => (await h.ctx.systemPrompt.assemble({ scope: a, agent: a })).contexts.find(value => value.name === 'dsh-pseudo-insideout')?.text || ''
  try {
    h.emit(a, 'turn/start', { turn: 1 })
    await h.preStep(a, 1, [message('external-turn-1', 'EXTERNAL_POLICY_PRIVATE_76ac')])
    h.emit(a, 'user/message', message('external-turn-1', '第一次关闭前收集的原话'))
    assert.match(await context(), /EXTERNAL_POLICY_PRIVATE_76ac/)
    assert.equal((await call()).isError, false)
    toggleExternally()
    assert.equal(notifications, 0, 'another SQLite connection does not invoke service listeners')
    assert.equal(external.get().enabled, true, 'the final boolean alone cannot reveal the intervening off transition')
    assert.equal((await call()).isError, true, 'tool activation checks the persisted policy version')
    assert.doesNotMatch(await context(), /EXTERNAL_POLICY_PRIVATE_76ac/)
    h.emit(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } })
    await settle()
    assert.equal(calls, 0); assert.equal(s.listMemories({}).total, 1)

    h.emit(a, 'turn/start', { turn: 2 })
    await h.preStep(a, 2, [message('external-turn-2', 'EXTERNAL_POLICY_PRIVATE_76ac')])
    assert.match(await context(), /EXTERNAL_POLICY_PRIVATE_76ac/)
    assert.equal((await call()).isError, false, 'a fresh full turn restores read access')
    h.emit(a, 'user/message', message('external-turn-2', '等待模型期间另一个进程再次关闭'))
    h.emit(a, 'turn/end', { turn: 2, reason: { kind: 'completed' } })
    await ready
    toggleExternally()
    assert.equal(notifications, 0)
    assert.equal(pendingSignal.aborted, false, 'no local callback has observed the external change yet')
    finish(); await settle()
    assert.equal(s.listMemories({}).total, 1, 'late analysis must recheck persisted policy before capturing')
    assert.equal(Object.values(s.emotion().values).some(Boolean), false)
    assert.equal((await call()).isError, true)
    assert.doesNotMatch(await context(), /EXTERNAL_POLICY_PRIVATE_76ac/)
    await h.preStep(a, 2, [message('external-turn-2-retry', 'EXTERNAL_POLICY_PRIVATE_76ac')])
    assert.doesNotMatch(await context(), /EXTERNAL_POLICY_PRIVATE_76ac/)

    h.emit(a, 'turn/start', { turn: 3 })
    await h.preStep(a, 3, [message('external-turn-3', 'EXTERNAL_POLICY_PRIVATE_76ac')])
    assert.equal((await call()).isError, false)
    h.emit(a, 'user/message', message('external-turn-3', '外部恢复后完整的新回合可以保存'))
    h.emit(a, 'turn/end', { turn: 3, reason: { kind: 'completed' } })
    await settle()
    const saved = s.listMemories({}).items
    assert.equal(saved.length, 2); assert.equal(calls, 2)
    assert.ok(saved.some(item => item.id === existing.id))
    assert.equal(saved.find(item => item.id !== existing.id).source.turnId, '3')
    assert.equal(notifications, 0)
  } finally { unsubscribe(); external.close() }
})

function sourceFixture(id = 'source') {
  const session = { id, version: 4, createdAt: 1000, cwd: '/workspace/a', agentPreset: 'default', isSeeded: false }
  const events = []
  const append = (type, data, surfaceOp) => {
    const event = { seq: events.length, time: 1700000000000 + events.length, type, data, ...(surfaceOp ? { surfaceOp } : {}) }
    events.push(event); return event
  }
  const turn = (number, input, options = {}) => {
    append('turn/start', { turn: number })
    const user = append('user/message', message(`u${number}`, input, options.source || 'user'), 'append')
    const assistant = append('assistant/message', { turn: number, message: { content: [{ type: 'reasoning', text: 'SECRET_REASONING' }, { type: 'text', text: `答复${number}` }, { type: 'tool-call', name: 'secret', arguments: 'SECRET_TOOL' }] }, ...(options.interrupted ? { interrupted: true } : {}) }, 'append')
    const end = append('turn/end', { turn: number, reason: { kind: options.reason || 'completed' } })
    return { user, assistant, end }
  }
  const excluded = new Set()
  const snapshot = { session, events, inheritedEventCount: 0 }
  const query = {
    async listSessions() { return [{ header: structuredClone(session), live: true, persisted: true }] },
    async readTitleSnapshots(ids) { return ids.map(sessionId => ({ sessionId, status: 'fulfilled', value: { session: structuredClone(session), title: { title: '来源会话' } } })) },
    async readSession(sessionId) { assert.equal(sessionId, id); return structuredClone(snapshot) },
    async readSurface(sessionId) { assert.equal(sessionId, id); return { session: structuredClone(session), inheritedEventCount: snapshot.inheritedEventCount, capturedThroughSeq: events.at(-1)?.seq ?? null, events: structuredClone(events.filter(event => event.surfaceOp && !excluded.has(event.seq))) } },
  }
  return { session, events, append, turn, excluded, snapshot, query }
}
const sourceRuntime = { workspaceId: '/workspace/a', agentId: 'default' }

test('DSH import reads only effective own completed human turns and excludes reasoning, tools and shadowed events', async () => {
  const f = sourceFixture()
  f.turn(1, '继承的原话')
  f.snapshot.inheritedEventCount = f.events.length
  f.session.isSeeded = true
  f.turn(2, '有效真人原话')
  f.turn(3, '失败的原话', { reason: 'aborted' })
  f.turn(4, '内部消息', { source: 'context' })
  const replaced = f.turn(5, '已被替换的原话')
  f.excluded.add(replaced.user.seq); f.excluded.add(replaced.assistant.seq)
  f.turn(6, '正常完成但助手前缀中断', { interrupted: true })
  f.append('turn/start', { turn: 7 })
  f.append('user/message', message('open', '尚未完成'), 'append')
  const result = await readDshImportSource(f.query, 'source', sourceRuntime)
  assert.deepEqual(result.records.map(record => record.userText), ['有效真人原话', '正常完成但助手前缀中断'])
  assert.equal(result.records[1].assistantText, '')
  assert.doesNotMatch(JSON.stringify(result), /SECRET_REASONING|SECRET_TOOL|继承的原话|已被替换的原话|尚未完成|内部消息/)
  assert.equal(result.sourceInfo.skipped.inheritedEvents, 4)
  assert.equal(result.sourceInfo.skipped.shadowedMessages, 2)
  assert.equal(result.sourceInfo.skipped.failedTurns, 1)
  assert.equal(result.sourceInfo.skipped.incompleteTurns, 1)
  const first = result.records[0]
  f.turn(8, '新增回合不会改变已选择的指纹')
  const next = await readDshImportSource(f.query, 'source', sourceRuntime)
  assert.equal(next.records[0].key, first.key)
  assert.equal(next.records[0].sourceFingerprint, first.sourceFingerprint)
  assert.notEqual(next.sourceSignature, result.sourceSignature)
})

test('DSH import rejects scope escapes, unstable reads and oversized sources without silent truncation', async () => {
  const f = sourceFixture()
  f.turn(1, '可读来源')
  await assert.rejects(readDshImportSource(f.query, '../source', sourceRuntime), { code: 'INVALID_SESSION' })
  await assert.rejects(readDshImportSource(f.query, 'source', { ...sourceRuntime, workspaceId: '/other' }), { code: 'IMPORT_SOURCE_SCOPE' })
  f.session.origin = 'subagent'
  await assert.rejects(readDshImportSource(f.query, 'source', sourceRuntime), { code: 'IMPORT_SOURCE_SCOPE' })
  delete f.session.origin
  const read = f.query.readSession
  f.query.readSession = async id => { f.turn(f.events.length, '并发变化'); return read(id) }
  await assert.rejects(readDshImportSource(f.query, 'source', sourceRuntime), { code: 'IMPORT_SOURCE_CHANGED' })
  f.query.readSession = read
  f.events.length = 20001
  await assert.rejects(readDshImportSource(f.query, 'source', sourceRuntime), { code: 'IMPORT_SOURCE_TOO_LARGE' })
})

test('DSH import adapter paginates scoped metadata, rereads commit source and leaves file imports to core', async () => {
  const f = sourceFixture()
  f.turn(1, '确认导入的来源')
  const service = { runtime: sourceRuntime, previewImport(body, source) { return { body, ...source } }, getImportPreview(id) { return { source: id === 'file' ? 'file' : 'dsh', sourceSessionId: 'source' } }, commitImport(body, source) { return { body, ...source } } }
  const run = createSessionImportExtension({ getSessions: () => f.query })
  const base = { service, query: new URLSearchParams('source=dsh'), body: {} }
  const listing = await run({ ...base, method: 'GET', path: '/imports/sessions' })
  assert.equal(listing.body.total, 1)
  assert.equal(listing.body.items[0].title, '来源会话')
  const preview = await run({ ...base, method: 'POST', path: '/imports/preview', body: { source: 'dsh', sourceSessionId: 'source', targetSessionId: 'target', offset: 0, limit: 1 } })
  assert.equal(preview.status, 200)
  f.events[1].data.content[0].text = '提交前已修改的来源'
  const commit = await run({ ...base, method: 'POST', path: '/imports/commit', body: { previewId: 'dsh', recordIds: [preview.body.records[0].key] } })
  assert.equal(commit.body.records[0].userText, '提交前已修改的来源')
  assert.notEqual(commit.body.records[0].sourceFingerprint, preview.body.records[0].sourceFingerprint)
  assert.equal(await run({ ...base, method: 'POST', path: '/imports/preview', body: { source: 'file' } }), undefined)
  assert.equal(await run({ ...base, method: 'POST', path: '/imports/commit', body: { previewId: 'file' } }), undefined)
  const unavailable = createSessionImportExtension({ getSessions: () => undefined })
  assert.equal((await unavailable({ ...base, method: 'GET', path: '/imports/sessions' })).body.available, false)
  const forged = await run({ ...base, method: 'POST', path: '/imports/preview', body: { source: 'dsh', sourceSessionId: 'source', targetSessionId: 'target', records: [{ userText: '伪造' }] } })
  assert.equal(forged.status, 400)
})
