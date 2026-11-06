// Synthetic, reproducible local benchmark. Every context build uses a new turn.
import { InsideOutService } from '../../src/core/service.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'insideout-search-bench-'));
let service = new InsideOutService({ dataDir: dir });
const measure = (operation, fn) => { const start = performance.now(); const value = fn(); return { operation, milliseconds: +(performance.now() - start).toFixed(2), items: value.items?.length }; };
try {
  service._tx(() => { for (let i = 0; i < 2000; i++) service.createMemory({ title: '规模测试 ' + i, content: '这段文字仅用于合成性能验证，描述日常经历与不同事项。'.repeat(90) + ' 编号 ' + i, source: { type: 'user', sessionId: 'size' }, importance: 0.5 }); });
  const measurements = [measure('state', () => service.state()), measure('listFirst50', () => service.listMemories({ limit: 50 }))];
  measurements.push(measure('search-first', () => service.searchActive({ sessionId: 'size', query: '特殊检索词' })));
  for (let i = 0; i < 5; i++) {
    measurements.push(measure('search-warm', () => service.searchActive({ sessionId: 'size', query: '特殊检索词' })));
    measurements.push(measure('buildContext-new-turn', () => service.buildContext({ sessionId: 'size', turnId: String(i), query: '特殊检索词' })));
  }
  service.close(); service = new InsideOutService({ dataDir: dir });
  measurements.push(measure('search-after-reopen', () => service.searchActive({ sessionId: 'size', query: '特殊检索词' })));
  measurements.push(measure('search-matching', () => service.searchActive({ sessionId: 'size', query: '编号 1942' })));
  const result = { syntheticOnly: true, node: process.version, memories: 2000, bodyCharsRange: [2345, 2348], measurements, limitation: 'Local synthetic samples; no production or concurrent-load latency guarantee.' };
  const output = process.argv.indexOf('--output'); if (output >= 0) writeFileSync(process.argv[output + 1], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { service.close(); rmSync(dir, { recursive: true, force: true }); }
