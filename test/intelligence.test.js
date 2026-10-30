import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalTurn, semanticSimilarity, summarizeEvidence, moodGuidance, inferQueryFilters } from '../src/core/intelligence.js';

const now = '2026-10-30T04:00:00.000Z';

test('offline extraction distinguishes stated preferences, habits, values and relationships', () => {
  const preference = analyzeLocalTurn('我不喜欢加糖的咖啡，更喜欢无糖拿铁。', { now });
  assert.equal(preference.kind, 'preference');
  assert.equal(preference.profileFacet, 'preference');
  assert.ok(preference.tags.includes('咖啡'));
  assert.ok(preference.semanticKeys.includes('stance:coffee:negative'));
  assert.ok(preference.semanticKeys.includes('stance:coffee:positive'), 'different conditional preferences are kept rather than collapsed');
  assert.match(preference.reason, /用户自述.*未经事实核验/);
  assert.equal(analyzeLocalTurn('I usually read books every morning.', { now }).profileFacet, 'habit');
  assert.equal(analyzeLocalTurn('我重视诚实，这是我的原则。', { now }).profileFacet, 'value');
  assert.equal(analyzeLocalTurn('My friend Alice lives nearby.', { now }).profileFacet, 'relationship');
  assert.ok(analyzeLocalTurn('My friend Alice lives nearby.', { now }).entities.includes('Alice'));
  assert.equal(analyzeLocalTurn('我的朋友小王喜欢咖啡。', { now }).profileFacet, 'relationship', 'a friend’s preference is not the user’s own preference');
  assert.equal(analyzeLocalTurn('My friend Alice likes coffee every morning.', { now }).profileFacet, 'relationship');
  assert.equal(analyzeLocalTurn('我对数据库设计感兴趣。', { now }).profileFacet, 'interest');
});

test('conditional, fictional, questions and assistant statements do not become personal facts', () => {
  for (const text of ['假设我喜欢咖啡，写一个故事。', 'If I liked coffee, I would drink it.', '助手说我喜欢咖啡。', 'The assistant said I love cats.', '我喜欢咖啡吗？', '请帮我分析我是不是喜欢咖啡。']) {
    const analysis = analyzeLocalTurn(text, { now });
    assert.equal(analysis.kind, 'episode', text);
    assert.equal(analysis.profileFacet, null, text);
    assert.equal(analysis.dueAt, null, text);
  }
  assert.equal(analyzeLocalTurn('假如我是飞行员。', { now }).fictional, true);
  assert.equal(analyzeLocalTurn('我喜欢科幻小说。', { now }).fictional, false);
  assert.equal(analyzeLocalTurn('I live near a cliff.', { now }).fictional, false, 'English if is a word, not a substring');
  assert.equal(analyzeLocalTurn('我不计划明天提交报告。', { now }).kind, 'episode');
  assert.notEqual(analyzeLocalTurn("I will not submit tomorrow.", { now }).kind, 'commitment');
});

test('explicit milestones receive high importance while negated importance does not', () => {
  assert.ok(analyzeLocalTurn('完成这个项目是我的人生转折，我永远不会忘。', { now }).importance >= 0.9);
  assert.ok(analyzeLocalTurn('This is a life-changing milestone for me.', { now }).importance >= 0.9);
  assert.ok(analyzeLocalTurn('这不是很重要，只是普通的一天。', { now }).importance < 0.9);
  assert.ok(analyzeLocalTurn('假设这件事是人生转折。', { now }).importance < 0.9);
});

test('commitment dates are conservative UTC day deadlines with invalid dates rejected', () => {
  const chinese = analyzeLocalTurn('我承诺明天提交海玻璃项目报告。', { now });
  assert.equal(chinese.kind, 'commitment');
  assert.equal(chinese.dueAt, '2026-10-31T23:59:59.999Z');
  assert.ok(chinese.entities.includes('海玻璃项目'));
  assert.equal(analyzeLocalTurn('I will submit on November 3, 2026.', { now }).dueAt, '2026-11-03T23:59:59.999Z');
  assert.equal(analyzeLocalTurn('我计划2026年2月30日提交。', { now }).dueAt, null);
  assert.equal(analyzeLocalTurn('我打算下周完成。', { now }).dueAt, null, 'a whole week is not a precise deadline');
  assert.equal(analyzeLocalTurn('我答应下周一提交。', { now }).dueAt, '2026-11-02T23:59:59.999Z');
  assert.equal(analyzeLocalTurn('我答应明天下午3点30分提交。', { now, timeZone: 'Asia/Shanghai' }).dueAt, '2026-10-31T07:30:00.000Z');
  assert.equal(analyzeLocalTurn('I will submit tomorrow at 9:30am.', { now }).dueAt, '2026-10-31T09:30:00.000Z');
  assert.equal(analyzeLocalTurn("I'll submit tomorrow.", { now }).kind, 'commitment');
  assert.equal(analyzeLocalTurn('我明天提交报告。', { now }).kind, 'commitment');
  assert.equal(analyzeLocalTurn('我昨天完成了报告。', { now }).dueAt, null);
});

test('query filters recognize explicit ranges, last week, recent dates and named entities', () => {
  assert.deepEqual(inferQueryFilters('回忆2026-10-01到2026-10-05的经历', now), { from: '2026-10-01T00:00:00.000Z', to: '2026-10-06T00:00:00.000Z' });
  assert.deepEqual(inferQueryFilters('上周关于海玻璃项目的进展', now), { from: '2026-10-19T00:00:00.000Z', to: '2026-10-26T00:00:00.000Z', entity: '海玻璃项目' });
  assert.deepEqual(inferQueryFilters('What happened last week?', now), { from: '2026-10-19T00:00:00.000Z', to: '2026-10-26T00:00:00.000Z' });
  assert.deepEqual(inferQueryFilters('近期的经历', now), { from: '2026-10-24T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' });
  assert.deepEqual(inferQueryFilters('过去3天', now), { from: '2026-10-28T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' });
  assert.deepEqual(inferQueryFilters('最近两天', now), { from: '2026-10-29T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' });
  assert.deepEqual(inferQueryFilters('最近0天', now), {});
  assert.deepEqual(inferQueryFilters('最近两个月', now), {}, 'an unsupported precise interval must not silently become seven days');
  assert.deepEqual(inferQueryFilters('关于小王的承诺', now), { entity: '小王' });
  assert.deepEqual(inferQueryFilters('memories about Alice', now), { entity: 'Alice' });
  assert.deepEqual(inferQueryFilters('2026-02-30', now), {});
  assert.deepEqual(inferQueryFilters('2026-11-03到2026-11-01', now), {});
  assert.deepEqual(inferQueryFilters('没有日期条件', 'invalid date'), {});
});

test('calendar inference uses the requested zone at local midnight and across DST', () => {
  const shanghaiMidnight = '2026-10-29T16:15:00.000Z'; // 00:15 on October 30 in Shanghai.
  const local = analyzeLocalTurn('我承诺明天提交报告。', { now: shanghaiMidnight, timeZone: 'Asia/Shanghai' });
  assert.equal(local.dueAt, '2026-10-31T15:59:59.999Z');
  assert.match(local.reason, /Asia\/Shanghai.*所选时区日末/);
  assert.deepEqual(inferQueryFilters('今天', shanghaiMidnight, 'Asia/Shanghai'), { from: '2026-10-29T16:00:00.000Z', to: '2026-10-30T16:00:00.000Z' });
  const spring = inferQueryFilters('2026-03-08', now, 'America/New_York');
  assert.deepEqual(spring, { from: '2026-03-08T05:00:00.000Z', to: '2026-03-09T04:00:00.000Z' });
  assert.equal(Date.parse(spring.to) - Date.parse(spring.from), 23 * 3_600_000);
  const autumn = inferQueryFilters('2026-11-01', now, 'America/New_York');
  assert.deepEqual(autumn, { from: '2026-11-01T04:00:00.000Z', to: '2026-11-02T05:00:00.000Z' });
  assert.equal(Date.parse(autumn.to) - Date.parse(autumn.from), 25 * 3_600_000);
  assert.deepEqual(inferQueryFilters('今天', now, 'Invalid/Timezone'), {});
  assert.equal(analyzeLocalTurn('我承诺明天提交。', { now, timeZone: 'Invalid/Timezone' }).dueAt, null);
  assert.deepEqual(inferQueryFilters('2011-12-30', now, 'Pacific/Apia'), {}, 'a skipped local date is not silently changed');
  const newYork = { now, timeZone: 'America/New_York' };
  assert.equal(analyzeLocalTurn('I will submit on March 8, 2026 at 2:30am.', newYork).dueAt, null, 'a nonexistent spring-forward clock time is rejected');
  assert.equal(analyzeLocalTurn('I will submit on November 1, 2026 at 1:30am.', newYork).dueAt, null, 'a repeated fall-back hour is not silently disambiguated');
  assert.equal(analyzeLocalTurn('I will submit on November 1, 2026 at 3:30am.', newYork).dueAt, '2026-11-01T08:30:00.000Z');
});

test('event dates only describe explicit past or completed current-day narratives', () => {
  const options = { now: '2026-10-29T16:15:00.000Z', timeZone: 'Asia/Shanghai' };
  assert.equal(analyzeLocalTurn('我昨天完成了报告。', options).eventAt, '2026-10-28T16:00:00.000Z');
  assert.equal(analyzeLocalTurn('我今天已经完成了报告。', options).eventAt, '2026-10-29T16:00:00.000Z');
  assert.equal(analyzeLocalTurn('我于2026年10月20日见到了小王。', options).eventAt, '2026-10-19T16:00:00.000Z');
  for (const text of ['我明天会完成报告。', '我计划今天提交报告。', '假设我昨天完成了报告。', '我今天参加会议。', '我喜欢2026年10月20日。', '我在2026年11月3日参加了会议。']) assert.equal(analyzeLocalTurn(text, options).eventAt, null, text);
});

test('explicit ISO timezone offsets are not reinterpreted in the configured local zone', () => {
  const options = { now, timeZone: 'Asia/Shanghai' };
  assert.equal(analyzeLocalTurn('我承诺2026-10-31T09:30:00Z提交报告。', options).dueAt, '2026-10-31T09:30:00.000Z');
  assert.equal(analyzeLocalTurn('我承诺2026-10-31T09:30:00+08:00提交报告。', options).dueAt, '2026-10-31T01:30:00.000Z');
  assert.equal(analyzeLocalTurn('我承诺2026-02-30T09:30:00Z提交报告。', options).dueAt, null);
  assert.equal(analyzeLocalTurn('我在2026-10-29T09:30:00Z完成了报告。', options).eventAt, '2026-10-29T09:30:00.000Z');
});

test('concept fallback finds bilingual paraphrases without substring or opposite-stance equivalence', () => {
  assert.ok(semanticSimilarity('小猫', { content: 'I enjoy spending time with kittens.' }) >= 0.7);
  assert.ok(semanticSimilarity('修复软件故障', { content: '今天在调试程序。' }) >= 0.7);
  assert.equal(semanticSimilarity('cat', { content: 'The application catalog is ready.' }), 0);
  assert.equal(semanticSimilarity('数据库', { content: '我今天骑自行车。' }), 0);
  assert.ok(semanticSimilarity('我喜欢咖啡', { content: '我不喜欢咖啡' }) < semanticSimilarity('我喜欢咖啡', { content: '我喜爱咖啡' }));
  assert.equal(semanticSimilarity('coffee', { content: 'coffee', fictional: true }), 0);
  assert.equal(semanticSimilarity('', { content: 'coffee' }), 0);
  assert.ok(semanticSimilarity('cat', { content: '记录A', semanticKeys: ['concept:cat'] }) >= 0.7);
  assert.ok(!analyzeLocalTurn('我不讨厌咖啡。', { now }).semanticKeys.includes('stance:coffee:negative'));
});

test('extractive synthesis integrates distinct accounts with every evidence reference', () => {
  const evidence = [
    { id: 'm-1', content: '我早晨偏爱无糖拿铁。' },
    { id: 'm-2', content: 'I prefer unsweetened coffee when working.' },
    { id: 'm-3', content: '我不喜欢咖啡，晚上会喝茶。' },
    { id: 'fiction', content: '假如我是咖啡之王。', fictional: true },
  ];
  const before = JSON.stringify(evidence);
  const summary = summarizeEvidence(evidence);
  for (const id of ['m-1', 'm-2', 'm-3']) assert.ok(summary.includes(`[${id}]`));
  assert.ok(summary.includes('共同涉及：咖啡'));
  assert.ok(summary.includes(evidence[1].content));
  assert.ok(summary.includes('我不喜欢咖啡'));
  assert.ok(!summary.includes('[fiction]'));
  assert.match(summary, /不同取向.*人工核对/);
  assert.equal(JSON.stringify(evidence), before, 'analysis must not mutate evidence');
  assert.match(summarizeEvidence([]), /无法生成/);
});

test('mood guidance explains expression changes without changing facts or authorization', () => {
  const input = { anger: 0.8, fear: 0.7, curiosity: 0.4 };
  const original = JSON.stringify(input), result = moodGuidance(input);
  assert.match(result, /愤怒 0\.80.*避免责备/);
  assert.match(result, /不确定性/);
  assert.match(result, /不改变事实.*工具权限.*外发授权/);
  assert.equal(JSON.stringify(input), original);
  assert.match(moodGuidance({ joy: NaN, anger: Infinity }), /接近基线/);
  assert.match(moodGuidance({ joy: 42 }), /喜悦 1\.00/);
});
