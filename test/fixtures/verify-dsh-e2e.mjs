// Run: node test/fixtures/verify-dsh-e2e.mjs --runtime /path/to/dsh/runtime [--tarball /path/final.tgz] [--output /path/to/report-directory] [--keep]
// Uses a new isolated profile, localhost-only synthetic provider, and real DSH loop.
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile, open, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes, createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const run = promisify(execFile), wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const here = dirname(fileURLToPath(import.meta.url)), project = resolve(here, '../..')
const runtimeArg = process.argv.indexOf('--runtime')
if (runtimeArg < 0 || !process.argv[runtimeArg + 1]) throw new Error('--runtime must name an existing official DSH installation directory')
const runtime = resolve(process.argv[runtimeArg + 1]), dsh = join(runtime, 'node_modules/.bin/dsh')
const tarballArg = process.argv.indexOf('--tarball')
if (tarballArg >= 0 && !process.argv[tarballArg + 1]?.endsWith('.tgz')) throw new Error('--tarball must name an existing npm .tgz archive')
const outputArg = process.argv.indexOf('--output')
if (outputArg >= 0 && (!process.argv[outputArg + 1] || process.argv[outputArg + 1].startsWith('--'))) throw new Error('--output must name a report directory')
const outputOverride = outputArg >= 0 ? resolve(process.argv[outputArg + 1]) : undefined
const isolated = await mkdtemp(join(tmpdir(), 'insideout-growth-e2e-'))
const workspace = join(isolated, 'work'), home = join(isolated, 'dsh-home')
let out = outputOverride || join(isolated, 'report')
await Promise.all([mkdir(join(workspace, 'secondary'), { recursive: true }), mkdir(home), mkdir(out, { recursive: true })])
const token = randomBytes(24).toString('hex'), requests = []
const report = { startedAt: new Date().toISOString(), dshVersion: null, nodeVersion: process.version, runtime, provider: 'localhost synthetic OpenAI-compatible SSE', realSupplierUsed: false, isolatedRoot: isolated, checks: [] }
const check = (name, details = {}) => { report.checks.push({ name, passed: true, ...details }); console.log(JSON.stringify({ check: name, passed: true })) }
const textOf = value => typeof value === 'string' ? value : Array.isArray(value) ? value.filter(v => v.type === 'text').map(v => v.text).join('\n') : ''
const provider = createServer(async (req, res) => {
  if (req.socket.remoteAddress !== '127.0.0.1') { res.writeHead(403); return res.end() }
  if (req.method === 'GET' && req.url === '/v1/models') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'insideout-test-model', object: 'model' }] })) }
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') { res.writeHead(404); return res.end() }
  try {
    let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 2e6) throw new Error('request too large') }
    const body = JSON.parse(raw), system = body.messages.filter(v => v.role === 'system' || v.role === 'developer').map(v => textOf(v.content)).join('\n')
    const users = body.messages.filter(v => v.role === 'user').map(v => textOf(v.content))
    const current = users.findLast(v => /^E2E_[A-Z_]+/.test(v.trim())) || users.at(-1) || ''
    let result, kind = 'conversation', tool = false
    if (system.includes('你整理一个模拟角色本轮的经历')) {
      kind = 'turn-analysis'
      const input = JSON.parse(users.at(-1))
      result = JSON.stringify({ confidence: 0.93, reason: '合成提供商按显式测试输入返回结构', emotions: { joy: 0.3, sadness: 0, fear: 0, anger: 0, disgust: 0, curiosity: 0.2 }, memory: { kind: input.userText.includes('E2E_RECORD_A') ? 'preference' : 'episode', importance: input.userText.includes('E2E_RECORD_A') ? 0.93 : 0.4, tags: ['合成验收'], entities: ['合成用户A'], fictional: false, dueAt: null, eventAt: null, profileFacet: input.userText.includes('E2E_RECORD_A') ? 'preference' : null, semanticKeys: ['简洁表达'], reason: '显式合成输入' }, proposals: [] })
    } else if (system.includes('你为本轮用户问题规划记忆检索')) {
      kind = 'semantic-recall'
      const input = JSON.parse(users.at(-1))
      result = JSON.stringify({ semanticHits: input.candidates.filter(v => v.content.includes('E2E_PRIVATE_ALPHA_7429')).slice(0, 1).map(v => ({ id: v.id, score: 0.98, reason: '匹配本轮测试查询' })) })
    } else if (current.includes('E2E_TOOL_A') && body.messages.at(-1).role !== 'tool') {
      tool = true; result = ''
    } else {
      result = current.includes('E2E_SESSION_B') ? 'B会话收到独立输入。' : current.includes('E2E_TOOL_A') ? '已完成只读记忆检索。' : '已收到本轮合成输入。'
    }
    requests.push({ at: new Date().toISOString(), kind, current, body, emittedTool: tool })
    await writeFile(join(isolated, 'synthetic-requests.json'), JSON.stringify(requests, null, 2), { mode: 0o600 })
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    const base = { id: `chatcmpl-synthetic-${requests.length}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: body.model }
    const emit = value => res.write(`data: ${JSON.stringify({ ...base, ...value })}\n\n`)
    emit({ choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })
    if (tool) emit({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: `synthetic-call-${requests.length}`, type: 'function', function: { name: 'insideout_search_memory', arguments: JSON.stringify({ query: 'E2E_PRIVATE_ALPHA_7429', limit: 3, maxChars: 3000 }) } }] }, finish_reason: null }] })
    else emit({ choices: [{ index: 0, delta: { content: result }, finish_reason: null }] })
    emit({ choices: [{ index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop' }] })
    emit({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 24, total_tokens: 144, prompt_tokens_details: { cached_tokens: 10 } } })
    res.end('data: [DONE]\n\n')
  } catch { res.writeHead(500); res.end() }
})
await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve))
const providerPort = provider.address().port
// Reserve a vacant web port, then release it immediately before DSH starts.
const reserve = createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve))
const webPort = reserve.address().port; await new Promise(resolve => reserve.close(resolve))
const base = `http://127.0.0.1:${webPort}`
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ['PATH', 'HOME', 'SHELL', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM', 'TZ'].includes(key)))
Object.assign(env, { DSH_HOME: home, DSH_AGENTS_HOME: join(isolated, 'agents-home'), DSH_TELEMETRY_DISABLED: '1', DSH_TELEMETRY_MODE: 'DISABLED', INSIDEOUT_SYNTHETIC_KEY: 'synthetic-test-only-not-a-secret' })
let child
const stop = async () => { if (child && child.exitCode === null) { child.kill('SIGTERM'); await Promise.race([new Promise(resolve => child.once('exit', resolve)), wait(5000)]); if (child.exitCode === null) child.kill('SIGKILL') } provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)) }
async function command(args, name) {
  try { const result = await run(dsh, args, { env, cwd: workspace, timeout: 180000, maxBuffer: 8e6 }); await writeFile(join(isolated, name), result.stdout + '\n' + result.stderr, { mode: 0o600 }); return result.stdout }
  catch (error) { await writeFile(join(isolated, name), String(error.stdout || '') + '\n' + String(error.stderr || ''), { mode: 0o600 }); throw new Error(`Isolated DSH command failed: ${name}`) }
}
let credentials, primaryScope
async function api(path, { method = 'GET', body, scope } = {}) {
  scope ??= primaryScope
  const response = await fetch(base + '/api/pseudo-insideout/v1' + path, { method, headers: { 'x-insideout-token': credentials.token, ...(scope ? { 'x-insideout-scope': scope } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const value = await response.json(); assert.ok(response.ok, `Memory API ${path}: ${response.status}`); return value
}
async function driver(path, body) {
  const response = await fetch(base + '/__insideout_e2e__/' + path, { method: 'POST', headers: { 'x-test-token': token, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
  const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value
}
async function turn(sessionId, text, space = 'primary') {
  const value = await driver('turn', { sessionId, text, space })
  await writeFile(join(isolated, sessionId + '-last-turn.json'), JSON.stringify(value, null, 2), { mode: 0o600 });
  assert.equal(value.events.findLast(v => v.type === 'turn/end')?.data.reason.kind, 'completed', 'real agent turn did not complete')
  return value
}
async function captured(sessionId, expected, scope) {
  for (let i = 0; i < 100; i++) {
    const rows = await api('/memories?limit=100', { scope })
    const selected = rows.items.filter(v => v.source.sessionId === sessionId)
    if (selected.length >= expected) return selected
    await wait(50)
  }
  throw new Error('Completed real turn did not produce captured memory')
}
async function setSessionPolicy(sessionId, override, scope) {
  const current = await api('/session-memory?sessionId=' + encodeURIComponent(sessionId), { scope })
  return api('/session-memory', { method: 'PATCH', scope, body: { sessionId, expectedVersion: current.version, override } })
}
async function setDefault(enabled) {
  const current = await api('/memory-default')
  return api('/memory-default', { method: 'PATCH', body: { expectedVersion: current.version, enabled } })
}
const newContexts = events => events.filter(event => event.type === 'user/message' && event.data?.source?.kind !== 'user').map(event => JSON.stringify(event.data)).join('\n')
try {
  const dshVersion = (await command(['--version'], 'version.log')).trim()
  assert.match(dshVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'DSH CLI did not return a valid version')
  report.dshVersion = dshVersion
  let tarball
  if (tarballArg >= 0) tarball = resolve(process.argv[tarballArg + 1])
  else {
    const packed = await run('npm', ['pack', '--json', '--pack-destination', isolated], { cwd: project, env, timeout: 60000, maxBuffer: 2e6 })
    tarball = join(isolated, JSON.parse(packed.stdout)[0].filename)
  }
  const manifest = JSON.parse((await run('tar', ['-xOf', tarball, 'package/package.json'])).stdout)
  out = outputOverride || join(project, 'output/delivery', manifest.version, `dsh-${dshVersion}`)
  await mkdir(out, { recursive: true })
  report.package = { filename: tarball.split('/').at(-1), name: manifest.name, version: manifest.version, sha256: createHash('sha256').update(await readFile(tarball)).digest('hex'), source: tarballArg >= 0 ? 'supplied-tarball' : 'fresh-candidate-pack' }
  await command(['--profile', 'web', '--dump-config'], 'initial-config.private.log')
  await command(['plugin', '--profile', 'web', 'add', tarball], 'installation.private.log')
  const profile = join(home, 'profiles/web')
  for (const path of ['src/dsh/host.js', 'src/dsh/session-import.js', 'src/core/service.js', 'src/core/policy.js', 'src/core/imports.js', 'src/core/import-file.js', 'src/core/intelligence.js', 'src/http/api.js', 'web/app.js', 'web/styles.css']) {
    const packaged = (await run('tar', ['-xOf', tarball, 'package/' + path], { encoding: 'buffer', maxBuffer: 4e6 })).stdout
    assert.deepEqual(await readFile(join(profile, 'node_modules', manifest.name, path)), packaged, `Installed runtime differs from tarball: ${path}`)
  }
  // Resolve the driver's DSH imports from the selected runtime, never this repo's
  // pinned development dependencies. Keep the runtime itself unchanged.
  const driverDir = join(isolated, 'driver'), driverFile = join(driverDir, 'dsh-e2e-driver.mjs')
  await mkdir(driverDir)
  await symlink(join(runtime, 'node_modules'), join(driverDir, 'node_modules'), 'junction')
  await writeFile(driverFile, await readFile(join(here, 'dsh-e2e-driver.js')))
  const patch = `- id: llm-pi-ai\n  config:\n    providers:\n      insideout-synthetic:\n        apiKeyEnv: INSIDEOUT_SYNTHETIC_KEY\n        api: openai-completions\n        baseURL: http://127.0.0.1:${providerPort}/v1\n        retryPolicy:\n          mode: normal\n          maxRetries: 0\n        models:\n          - id: insideout-test-model\n            contextWindow: 64000\n            maxTokens: 4000\n            reasoningEfforts: false\n- id: agent-default-model\n  config:\n    provider: insideout-synthetic\n    model: insideout-test-model\n- id: pseudo-insideout\n  config:\n    analyzeTurns: true\n- insert:\n    - id: insideout-synthetic-driver\n      name: ${JSON.stringify(driverFile)}\n      config:\n        token: ${token}\n        workspace: ${JSON.stringify(workspace)}\n`
  await writeFile(join(profile, 'cordis.patch.yml'), patch, { mode: 0o600 })
  await command(['--profile', 'web', '--dump-config'], 'effective-config.private.log')
  const log = await open(join(isolated, 'host.private.log'), 'w', 0o600)
  child = spawn(dsh, ['--profile', 'web', '--host', '127.0.0.1', '--port', String(webPort), '--no-open'], { env, cwd: workspace, stdio: ['ignore', log.fd, log.fd] })
  await log.close()
  for (let i = 0; i < 200; i++) {
    try { const html = await (await fetch(base + '/pseudo-insideout/')).text(); const match = html.match(/<script\b[^>]*id="insideout-boot"[^>]*>([^<]+)<\/script>/); if (match) { credentials = JSON.parse(match[1]); break } } catch {}
    if (child.exitCode !== null) break
    await wait(100)
  }
  assert.ok(credentials, 'Official web host did not become ready; inspect isolated host log')
  check('官方 CLI 安装候选包并启动完整隔离 Web 宿主')
  const a = 'insideout-e2e-session-a', b = 'insideout-e2e-session-b'
  const first = await turn(a, 'E2E_RECORD_A：我偏好简洁表达。我的私有测试口令是 E2E_PRIVATE_ALPHA_7429。')
  primaryScope = (await api('/state')).runtime.scopeId
  const stored = (await captured(a, 1))[0]
  assert.equal(stored.extraction.method, 'host-model'); assert.equal(stored.kind, 'preference'); assert.equal(stored.importance, 0.93)
  assert.ok(first.events.some(v => v.type === 'assistant/message'))
  check('真实 agent.followup 完成会话并自动捕获结构化记忆', { sessionId: a, memoryId: stored.id })
  await turn(a, 'E2E_RECALL_A：还记得我的表达偏好和测试口令吗？')
  await captured(a, 2)
  const recallRequest = requests.find(v => v.kind === 'conversation' && v.current.includes('E2E_RECALL_A'))
  assert.ok(recallRequest)
  assert.ok(recallRequest.body.messages.some(v => textOf(v.content).includes('dsh-pseudo-insideout') && textOf(v.content).includes(stored.id)), 'newly injected context did not reach provider')
  check('下一真实回合的模型请求含新增记忆参考与真实记忆 ID')
  await turn(b, 'E2E_SESSION_B：请说明你收到的本轮输入。')
  await captured(b, 1)
  const other = requests.find(v => v.kind === 'conversation' && v.current.includes('E2E_SESSION_B'))
  assert.ok(other); assert.ok(!JSON.stringify(other.body).includes('E2E_PRIVATE_ALPHA_7429'))
  check('同工作区第二会话的完整模型请求不含 A 私有记忆', { sessionId: b })
  const toolTurn = await turn(a, 'E2E_TOOL_A：请用 insideout_search_memory 查找我的测试口令。')
  await captured(a, 3)
  assert.ok(toolTurn.events.some(v => v.type === 'tool/call'))
  const toolReturn = toolTurn.events.find(v => v.type === 'tool/result')
  assert.ok(toolReturn); assert.ok(JSON.stringify(toolReturn).includes('E2E_PRIVATE_ALPHA_7429'))
  check('真实模型工具调用经官方原生工具管线返回活跃记忆')
  const recalls = await api('/recalls?sessionId=' + a)
  const usage = recalls.items.flatMap(v => v.usage || [])
  assert.ok(usage.some(v => v.purpose === 'semantic-recall' && v.inputTokens > 0 && v.status === 'success'))
  assert.ok(usage.some(v => v.purpose === 'turn-analysis' && v.outputTokens > 0 && v.status === 'success'))
  check('辅助分析与语义召回用量由实际 SSE usage 回执记录', { usageRows: usage.length })

  // 1.2: policy changes affect future host work, while existing transcript stays host-owned.
  await setSessionPolicy(a, 'off')
  const beforeMutedRequests = requests.length
  const muted = await turn(a, 'E2E_SESSION_OFF：记忆关闭时完成这一真实回合，不应新增记忆参考或捕获。')
  await wait(150)
  assert.equal((await api('/memories?limit=100')).items.filter(value => value.source.sessionId === a).length, 3)
  assert.ok(!requests.slice(beforeMutedRequests).some(value => value.kind !== 'conversation'), 'disabled session made an auxiliary call')
  assert.ok(!newContexts(muted.events).includes('dsh-pseudo-insideout'), 'disabled turn appended fresh memory context')
  check('单会话关闭后真实回合正常完成且不捕获、不新增注入、不调用辅助模型')
  await setSessionPolicy(a, 'on')
  const reopened = await turn(a, 'E2E_REOPEN_A：现在重新开启，请回想我的表达偏好。')
  await captured(a, 4)
  assert.ok(newContexts(reopened.events).includes(stored.id), 'next complete turn did not regain memory context')
  check('单会话重新开启后下一个完整真实回合恢复召回和捕获')

  await setDefault(false)
  const c = 'insideout-e2e-secondary-c'
  await driver('session', { sessionId: c, action: 'create', space: 'secondary' })
  const secondaryScope = (await api('/state')).scopes.find(scope => scope.workspaceId === join(workspace, 'secondary'))?.id
  assert.ok(secondaryScope)
  const inherited = await api('/session-memory?sessionId=' + c, { scope: secondaryScope })
  assert.equal(inherited.override, 'inherit'); assert.equal(inherited.effectiveEnabled, false)
  const beforeDefaultRequests = requests.length
  const defaultMuted = await turn(c, 'E2E_DEFAULT_OFF_C：新工作区会话继承同profile默认关闭。', 'secondary')
  await wait(150)
  assert.equal((await api('/memories?limit=100', { scope: secondaryScope })).total, 0)
  assert.ok((await api('/state', { scope: secondaryScope })).sessions.some(session => session.id === c), 'muted new session was not registered')
  assert.ok(!requests.slice(beforeDefaultRequests).some(value => value.kind !== 'conversation'))
  assert.ok(!newContexts(defaultMuted.events).includes('dsh-pseudo-insideout'))
  check('profile默认关闭跨工作区生效；关闭的新会话仍出现在会话目录')
  await setSessionPolicy(c, 'on', secondaryScope)
  await turn(c, 'E2E_DEFAULT_OVERRIDE_ON_C：本会话单独开启后记录这轮。', 'secondary')
  await captured(c, 1, secondaryScope)
  assert.equal((await api('/memory-default', { scope: secondaryScope })).enabled, false)
  assert.equal((await api('/session-memory?sessionId=' + a)).effectiveEnabled, true)
  check('显式会话开启覆盖全局默认关闭，且不同工作区共用同一默认值')

  // The source is a real persisted root session with automatic capture disabled.
  const historySession = 'insideout-e2e-history-source'
  await turn(historySession, 'E2E_HISTORY_SELECTED：确认可导入的历史片段，标记 HISTORY_SELECTED_1367。')
  await turn(historySession, 'E2E_HISTORY_UNSELECTED：不勾选的历史片段，标记 HISTORY_UNSELECTED_8251。')
  await wait(100)
  assert.ok(!(await api('/memories?limit=100')).items.some(value => value.source.sessionId === historySession))
  const detached = await driver('session', { sessionId: historySession, action: 'detach' })
  assert.equal(detached.live, false)
  const directory = await api('/imports/sessions?source=dsh&limit=100')
  assert.equal(directory.available, true)
  assert.match(directory.visibility, /当前宿主可见/)
  assert.ok(directory.items.some(session => session.id === historySession))
  assert.ok(!directory.items.some(session => session.id === c), 'history listing crossed workspace scope')
  const searched = await api('/imports/sessions?source=dsh&q=' + historySession + '&offset=0&limit=1')
  assert.equal(searched.total, 1); assert.equal(searched.items[0].id, historySession)
  check('DSH公共会话目录可搜索已卸载的历史根会话，并排除其他工作区')
  const beforeImport = await api('/state'), beforeImportRequests = requests.length
  const preview = await api('/imports/preview', { method: 'POST', body: { source: 'dsh', sourceSessionId: historySession, targetSessionId: a, offset: 0, limit: 200 } })
  assert.equal(preview.total, 2)
  assert.equal(preview.items.length, 2)
  assert.equal((await api('/state')).counts.active, beforeImport.counts.active, 'preview wrote memory')
  const selected = preview.items.find(item => item.excerpt.includes('HISTORY_SELECTED_1367'))
  assert.ok(selected); assert.equal(selected.status, 'ready')
  const selection = { previewId: preview.previewId, recordIds: [selected.id] }
  const imported = await api('/imports/commit', { method: 'POST', body: selection })
  assert.equal(imported.createdCount, 1); assert.equal(imported.imported.length, 1)
  const repeated = await api('/imports/commit', { method: 'POST', body: selection })
  assert.equal(repeated.createdCount, 0); assert.equal(repeated.linkedCount, 0); assert.equal(repeated.skippedCount, 1)
  const targetVisible = (await api('/memories?sessionId=' + a + '&limit=100')).items
  const selectedMemory = targetVisible.find(memory => memory.id === imported.imported[0].id)
  assert.ok(selectedMemory); assert.equal(selectedMemory.extraction.method, 'local-rules')
  assert.equal(selectedMemory.source.sessionId, historySession)
  assert.ok(!targetVisible.some(memory => memory.content.includes('HISTORY_UNSELECTED_8251')))
  assert.equal(requests.length, beforeImportRequests, 'explicit history import invoked a model')
  const afterImport = await api('/state')
  assert.equal(afterImport.emotion.updatedAt, beforeImport.emotion.updatedAt)
  assert.equal(afterImport.counts.pending, beforeImport.counts.pending)
  assert.equal((await api('/session-memory?sessionId=' + a)).override, 'on')
  const sourceAfter = await driver('session', { sessionId: historySession, action: 'inspect' })
  assert.equal(sourceAfter.live, false); assert.equal(sourceAfter.digest, detached.digest); assert.equal(sourceAfter.eventCount, detached.eventCount)
  check('历史预览只读；仅勾选片段提交、重复提交幂等；源未恢复或改写、无辅助模型及情绪更新', { importedMemoryId: selectedMemory.id, sourceEventCount: sourceAfter.eventCount })
  const recallImported = await turn(a, 'E2E_IMPORTED_RECALL：请回想 HISTORY_SELECTED_1367 这段导入片段。')
  await captured(a, 5)
  assert.ok(newContexts(recallImported.events).includes(selectedMemory.id), 'selected imported memory was not newly injected')
  assert.ok(!newContexts(recallImported.events).includes('HISTORY_UNSELECTED_8251'))
  check('显式导入的所选历史在目标会话下一真实回合召回，未选正文不注入')

  const logText = (await readFile(join(isolated, 'host.private.log'), 'utf8')).replace(/\x1b\[[0-9;]*m/g, '')
  const authUrl = logText.match(new RegExp(`http://127\\.0\\.0\\.1:${webPort}/\\?token=[A-Za-z0-9_-]+`))?.[0]
  if (authUrl) await writeFile(join(isolated, 'auth-url.txt'), authUrl, { mode: 0o600 })
  report.webBase = base; report.hostPid = child.pid; report.providerPid = process.pid; report.authFile = join(isolated, 'auth-url.txt'); report.requestCount = requests.length
  report.finishedAt = new Date().toISOString()
  await writeFile(join(out, 'synthetic-host-e2e.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ success: true, report: join(out, 'synthetic-host-e2e.json'), webBase: base, isolatedRoot: isolated, keep: process.argv.includes('--keep') }))
  if (process.argv.includes('--keep')) {
    process.on('SIGTERM', () => { void stop().finally(() => process.exit()) })
    process.on('SIGINT', () => { void stop().finally(() => process.exit()) })
  } else await stop()
} catch (error) {
  report.error = error.message; report.finishedAt = new Date().toISOString()
  await writeFile(join(out, 'synthetic-host-e2e.json'), JSON.stringify(report, null, 2) + '\n')
  console.error(JSON.stringify({ failed: true, error: error.message, isolatedRoot: isolated }))
  await stop(); process.exitCode = 1
}
