#!/usr/bin/env node
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { InsideOutService } from '../src/core/service.js';
import { createHttpHandler } from '../src/dsh/host.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const port = Number(value('--port', '3088'));
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
const dataDir = resolve(value('--data-dir', '.insideout-dev'));
const service = new InsideOutService({ dataDir, runtime: { mode: 'standalone', connected: false, workspaceId: '独立控制台 · 非 DSH 会话', agentId: 'preview' } });
if (args.includes('--demo') && service.state().counts.active === 0 && service.state().counts.archive === 0) {
  const base = new Date();
  const examples = [
    { title: '第一次完成独立项目', content: '【演示数据】我独立完成了一个小项目，想把这件事记下来。', importance: 0.95, tags: ['创造'], emotions: { joy: 0.7, curiosity: 0.4 } },
    { title: '喜欢安静地思考', content: '【演示数据】我喜欢先独立思考，再讨论方案。', kind: 'preference', tags: ['创造'], emotions: { curiosity: 0.5 } },
    { title: '重新理解一次挫折', content: '【演示数据】一次没有得到回应的分享，也是一段有价值的练习。', tags: ['创造'], emotions: { sadness: 0.3, joy: 0.2 } },
    { title: '一段封存的旅途', content: '【演示数据】曾经记录过的一段海边旅行。', tags: ['旅途'], emotions: { joy: 0.6 } },
  ];
  examples.forEach((sample, i) => {
    const memory = service.createMemory({ ...sample, eventAt: new Date(base.getTime() - (i + 1) * 86_400_000).toISOString(), visibility: 'workspace', source: { type: 'import', sessionId: 'demo-session', turnId: `demo-${i}` } });
    if (i === 3) service.archiveMemory(memory.id, { expectedVersion: 1, reason: '演示独立档案库' });
  });
  service.runDream();
  console.log('已明确载入合成演示数据；没有连接 DSH 或调用模型。');
}
const token = randomBytes(32).toString('hex');
const handler = createHttpHandler({ getService: () => service, token, mode: 'standalone' });
const server = createServer((req, res) => {
  if (req.url === '/') { res.writeHead(302, { location: '/pseudo-insideout/' }); return res.end(); }
  handler(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
});
server.listen(port, '127.0.0.1', () => console.log(`独立控制台（DSH 未连接）：http://127.0.0.1:${server.address().port}/pseudo-insideout/`));
const shutdown = () => server.close(() => { service.close(); process.exit(0); });
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
