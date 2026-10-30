// Pure, offline fallbacks. These finite concept rules are not embeddings, truth
// verification, a psychological assessment, or permission to execute recalled text.
const DAY = 86_400_000;
const CONCEPTS = [
  ['coffee', '咖啡', /咖啡|拿铁|卡布奇诺|浓缩咖啡|\b(?:coffee|espresso|latte|cappuccino)\b/iu],
  ['tea', '茶', /喝茶|茶叶|绿茶|红茶|乌龙|奶茶|\b(?:tea|matcha)\b/iu],
  ['sugar-free', '无糖', /无糖|不加糖|少糖|\b(?:sugar[ -]free|unsweetened|without sugar|no sugar)\b/iu],
  ['cat', '猫', /猫咪|小猫|喵星人|猫|\b(?:cats?|kittens?|felines?)\b/iu],
  ['dog', '狗', /小狗|狗狗|汪星人|狗|\b(?:dogs?|pupp(?:y|ies)|canines?)\b/iu],
  ['coding', '编程', /编程|写代码|程序开发|软件开发|\b(?:coding|programming|software development|write code)\b/iu],
  ['debugging', '排错', /排错|调试|报错|程序故障|软件故障|修复.{0,5}(?:错误|故障)|\b(?:debugging|debug|bug fixing|software bugs?|troubleshoot(?:ing)?)\b/iu],
  ['database', '数据库', /数据库|结构化查询|\b(?:databases?|sql|sqlite|postgresql|mysql)\b/iu],
  ['javascript', 'JavaScript', /\b(?:javascript|typescript|node\.?js)\b/iu],
  ['python', 'Python', /\bpython\b/iu],
  ['cycling', '骑行', /自行车|单车|骑行|\b(?:cycling|bicycles?|bikes?|biking)\b/iu],
  ['running', '跑步', /跑步|慢跑|马拉松|\b(?:jogging|jog|running|marathons?)\b/iu],
  ['exercise', '运动', /运动|锻炼|健身|\b(?:exercise|workouts?|fitness)\b/iu],
  ['reading', '阅读', /阅读|读书|看书|\b(?:reading|read books?|book reading)\b/iu],
  ['music', '音乐', /音乐|弹琴|钢琴|吉他|\b(?:music|piano|guitar)\b/iu],
  ['cooking', '烹饪', /做饭|烹饪|下厨|\b(?:cooking|cook|cuisine)\b/iu],
  ['travel', '旅行', /旅行|旅游|出游|\b(?:travel(?:ling|ing)?|tourism|vacations?)\b/iu],
  ['learning', '学习', /学习|学会|进修|\b(?:learning|studying|study|learn)\b/iu],
  ['family', '家人', /家人|父母|母亲|父亲|妈妈|爸爸|\b(?:family|parents?|mother|father)\b/iu],
  ['friendship', '朋友', /朋友|友谊|友情|\b(?:friends?|friendship)\b/iu],
  ['partner', '伴侣', /伴侣|爱人|丈夫|妻子|男朋友|女朋友|\b(?:partner|spouse|husband|wife|boyfriend|girlfriend)\b/iu],
  ['honesty', '诚实', /诚实|诚信|坦诚|\b(?:honesty|honest|integrity)\b/iu],
  ['privacy', '隐私', /隐私|私密|\b(?:privacy|confidentiality)\b/iu],
  ['reliability', '守约', /守约|守信|信守承诺|\b(?:reliability|keeping promises|keep promises)\b/iu],
  ['autonomy', '自主', /自主|独立决定|自己决定|\b(?:autonomy|self[ -]determination)\b/iu],
  ['environment', '环保', /环保|环境保护|\b(?:environmental protection|sustainability|eco[ -]friendly)\b/iu],
];
const FACET_LABELS = { preference: '偏好', relationship: '关系', habit: '习惯', value: '价值取向', interest: '兴趣' };
const normalize = value => String(value ?? '').normalize('NFKC').trim();
const unique = values => [...new Set(values)];
const concepts = text => CONCEPTS.filter(([, , pattern]) => pattern.test(text));
const nowDate = now => {
  const date = now === undefined ? new Date() : new Date(now);
  return Number.isFinite(date.getTime()) ? date : null;
};
const dayStart = date => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const validDay = (year, month, day) => {
  const value = Date.UTC(year, month - 1, day);
  const date = new Date(value);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null;
};
const iso = value => new Date(value).toISOString();
const monthNumbers = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const chineseNumber = text => {
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (digits[text]) return digits[text];
  const match = text.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/u);
  return match ? (digits[match[1]] ?? 1) * 10 + (digits[match[2]] ?? 0) : null;
};

function explicitDays(text, now) {
  const matches = [];
  const fullDate = /(?<!\d)(\d{4})\s*(?:年|[-/])\s*(\d{1,2})\s*(?:月|[-/])\s*(\d{1,2})(?:日|号)?(?!\d)/gu;
  for (const match of text.matchAll(fullDate)) matches.push({ at: match.index, end: match.index + match[0].length, day: validDay(+match[1], +match[2], +match[3]) });
  for (const match of text.matchAll(/(?<![\d年/-])(\d{1,2})月(\d{1,2})(?:日|号)/gu)) {
    if (matches.some(item => match.index >= item.at && match.index < item.end)) continue;
    if (now) matches.push({ at: match.index, end: match.index + match[0].length, day: validDay(now.getUTCFullYear(), +match[1], +match[2]) });
  }
  const english = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/giu;
  for (const match of text.matchAll(english)) {
    const year = match[3] ? +match[3] : now?.getUTCFullYear();
    if (year) matches.push({ at: match.index, end: match.index + match[0].length, day: validDay(year, monthNumbers[match[1].slice(0, 3).toLowerCase()], +match[2]) });
  }
  return matches.sort((a, b) => a.at - b.at);
}

function calendarRange(text, now) {
  const explicit = explicitDays(text, now);
  // An invalid calendar date must not quietly turn into a different relative date.
  if (explicit.length) {
    if (explicit.some(item => item.day === null)) return null;
    const first = explicit[0].day, last = explicit.at(-1).day;
    if (last < first) return null;
    return { from: first, to: last + DAY, exactDay: explicit.length === 1 };
  }
  if (!now) return null;
  const today = dayStart(now);
  for (const [pattern, offset] of [[/后天|\bday after tomorrow\b/iu, 2], [/前天|\bday before yesterday\b/iu, -2], [/明天|\btomorrow\b/iu, 1], [/昨天|\byesterday\b/iu, -1], [/今天|今日|\btoday\b/iu, 0]]) {
    if (pattern.test(text)) return { from: today + offset * DAY, to: today + (offset + 1) * DAY, exactDay: true };
  }
  const weekday = text.match(/(上|下|本|这)?(?:周|星期)([一二三四五六日天])/u);
  const englishWeekday = text.match(/\b(last|next|this)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/iu);
  const monday = today - ((now.getUTCDay() + 6) % 7) * DAY;
  if (weekday) {
    const offset = weekday[1] === '上' ? -7 : weekday[1] === '下' ? 7 : 0;
    const index = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 }[weekday[2]];
    return { from: monday + (offset + index) * DAY, to: monday + (offset + index + 1) * DAY, exactDay: true };
  }
  if (englishWeekday) {
    const offset = { last: -7, next: 7, this: 0 }[englishWeekday[1].toLowerCase()];
    const index = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(englishWeekday[2].toLowerCase());
    return { from: monday + (offset + index) * DAY, to: monday + (offset + index + 1) * DAY, exactDay: true };
  }
  const weeks = text.match(/(上|下|本|这)周/u) ?? text.match(/\b(last|next|this)\s+week\b/iu);
  if (weeks) {
    const modifier = weeks[1].toLowerCase();
    const offset = ['上', 'last'].includes(modifier) ? -7 : ['下', 'next'].includes(modifier) ? 7 : 0;
    return { from: monday + offset * DAY, to: monday + (offset + 7) * DAY, exactDay: false };
  }
  const days = text.match(/(?:最近|过去|近)\s*(\d{1,3}|[一二两三四五六七八九十]+)\s*天/u) ?? text.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/iu);
  if (days) {
    const count = /^\d+$/u.test(days[1]) ? +days[1] : chineseNumber(days[1]);
    return count >= 1 && count <= 366 ? { from: today - (count - 1) * DAY, to: today + DAY, exactDay: false } : null;
  }
  if (/(?:最近|过去|近)\s*(?:\d|[一二两三四五六七八九十])|\b(?:last|past)\s+\d/iu.test(text)) return null;
  if (/近期|最近|\brecent(?:ly)?\b/iu.test(text)) return { from: today - 6 * DAY, to: today + DAY, exactDay: false };
  return null;
}

function calendarTools(timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const ordinal = instant => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(part => part.type !== 'literal').map(part => [part.type, +part.value]));
      return Date.UTC(parts.year, parts.month - 1, parts.day);
    };
    // Find the first instant on/after a local calendar date. The local date is
    // monotone even during a repeated DST hour. This also handles midnight gaps.
    const boundary = target => {
      let low = target - 2 * DAY, high = target + 2 * DAY;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (ordinal(middle) >= target) high = middle;
        else low = middle + 1;
      }
      return low;
    };
    return { ordinal, boundary };
  } catch { return null; }
}

function temporalRange(text, now, timeZone) {
  const tools = calendarTools(timeZone);
  if (!tools) return null;
  const today = now ? tools.ordinal(now.getTime()) : null;
  const range = calendarRange(text, today === null ? null : new Date(today));
  if (!range) return null;
  const from = tools.boundary(range.from), to = tools.boundary(range.to);
  // Some historical timezone changes skipped a complete calendar date.
  if (tools.ordinal(from) !== range.from || from >= to) return null;
  return { ...range, from, to, calendarFrom: range.from, calendarToday: today };
}

function clockSpec(text) {
  const found = [];
  for (const match of text.matchAll(/(?:(凌晨|早上|上午|中午|下午|晚上)\s*)?(\d{1,2})(?:点|时)(?:(\d{1,2})(?:分)?|(半))?/gu)) {
    let hour = +match[2];
    const period = match[1], minute = match[4] ? 30 : +(match[3] ?? 0);
    if (period && (hour < 1 || hour > 12)) return { invalid: true };
    if (['下午', '晚上', '中午'].includes(period) && hour < 12) hour += 12;
    if (period === '凌晨' && hour === 12) hour = 0;
    if (period === '晚上' && hour === 12) return { invalid: true };
    found.push({ hour, minute, second: 0 });
  }
  for (const match of text.matchAll(/(?<!\d)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\b/giu)) {
    let hour = +match[1];
    const period = match[4]?.toLowerCase();
    if (period && (hour < 1 || hour > 12)) return { invalid: true };
    if (period === 'am' && hour === 12) hour = 0;
    if (period === 'pm' && hour < 12) hour += 12;
    found.push({ hour, minute: +match[2], second: +(match[3] ?? 0) });
  }
  for (const match of text.matchAll(/(?<![\d:])(\d{1,2})\s*(am|pm)\b/giu)) {
    let hour = +match[1];
    if (hour < 1 || hour > 12) return { invalid: true };
    if (match[2].toLowerCase() === 'am' && hour === 12) hour = 0;
    if (match[2].toLowerCase() === 'pm' && hour < 12) hour += 12;
    found.push({ hour, minute: 0, second: 0 });
  }
  if (!found.length) return null;
  if (found.some(item => item.hour > 23 || item.minute > 59 || item.second > 59)) return { invalid: true };
  const distinct = unique(found.map(item => JSON.stringify(item)));
  return distinct.length === 1 ? JSON.parse(distinct[0]) : { invalid: true };
}

function wallClockInstant(range, time, timeZone) {
  if (!range || time?.invalid) return null;
  if (!time) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const wallStamp = instant => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(part => part.type !== 'literal').map(part => [part.type, +part.value]));
      return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    };
    const desired = range.calendarFrom + time.hour * 3_600_000 + time.minute * 60_000 + time.second * 1000;
    const offsets = new Set();
    for (let probe = range.from - DAY; probe <= range.to + DAY; probe += 3_600_000) offsets.add(wallStamp(probe) - probe);
    const candidates = [...offsets].map(offset => desired - offset).filter(instant => instant >= range.from && instant < range.to && wallStamp(instant) === desired);
    // A nonexistent spring-forward time or repeated fall-back time needs user
    // clarification; choosing either instant silently would invent precision.
    return candidates.length === 1 ? candidates[0] : null;
  } catch { return null; }
}

function absoluteTime(text) {
  const matches = [...text.matchAll(/(?<!\d)(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))(?!\d)/giu)];
  if (!matches.length) return null;
  const values = unique(matches.map(match => match[1]));
  if (values.length !== 1) return { instant: null };
  const value = values[0], instant = Date.parse(value);
  return { instant: validDay(+value.slice(0, 4), +value.slice(5, 7), +value.slice(8, 10)) !== null && Number.isFinite(instant) ? instant : null };
}

function extractEntities(text) {
  const found = [];
  for (const match of text.matchAll(/[“「『]([^”」』\n]{2,40})[”」』]/gu)) {
    if (!/[。！？!?]/u.test(match[1]) && /项目|计划|公司|实验室|大学|\b(?:project|company|university)\b/iu.test(match[1])) found.push(match[1]);
  }
  for (const match of text.matchAll(/([\p{Script=Han}A-Za-z0-9_-]{2,18}(?:项目|计划|公司|实验室|大学))/gu)) {
    const parts = match[1].split(/关于|有关|回忆|查看|记得|提到|参加|完成|提交|负责|加入|名为|叫做|在|的|与|和/u);
    const name = parts.at(-1).replace(/^(?:(?:今天|昨天|明天|上周|下周|本周|最近)|(?:我|我们|请|这个|那个))+/u, '');
    if (name.length > 2 && !['这个项目', '那个项目', '工作计划', '我的计划'].includes(name)) found.push(name);
  }
  for (const match of text.matchAll(/\b(?:project|company|university|friend|colleague|partner)\s+([A-Z][\p{L}\p{N}_-]{1,35})\b/gu)) found.push(match[1]);
  for (const match of text.matchAll(/(?:朋友|同事|伴侣)(?:叫|是)?([\p{Script=Han}]{2,4})(?=[，。！？\s]|一起|和我|喜欢|住在|今天|昨天|明天|$)/gu)) found.push(match[1]);
  for (const match of text.matchAll(/(?:我叫|我的名字是)([\p{Script=Han}]{2,4}?)(?=[，。！？\s]|$)|\bmy name is\s+([A-Z][\p{L}-]{1,35})\b/gu)) found.push(match[1] ?? match[2]);
  for (const match of text.matchAll(/(?:关于|有关|人名)[“「"]?([\p{Script=Han}]{2,4}?)(?=[”」"]|的|[，。！？\s]|$)|\b(?:about|with)\s+([A-Z][\p{L}-]{1,35})\b/gu)) {
    const entity = match[1] ?? match[2];
    if (!concepts(entity).length) found.push(entity);
  }
  for (const [label, pattern] of [['母亲', /妈妈|母亲|\bmy mother\b/iu], ['父亲', /爸爸|父亲|\bmy father\b/iu], ['伴侣', /我的伴侣|我的爱人|我丈夫|我妻子|\bmy (?:partner|spouse|husband|wife)\b/iu]]) if (pattern.test(text)) found.push(label);
  for (const name of ['PostgreSQL', 'SQLite', 'JavaScript', 'TypeScript', 'Python', 'GitHub']) if (new RegExp(`\\b${name}\\b`, 'iu').test(text)) found.push(name);
  return unique(found).slice(0, 16);
}

const clauses = text => text.split(/[，,。.!?！？;；\n]|\b(?:but|however|and)\b|但是|不过/iu).filter(Boolean);
function stance(text) {
  const signs = new Set();
  for (const clause of clauses(text)) {
    if (/不是不喜欢|并非不喜欢|不讨厌|不厌恶|\b(?:do not|don't|not) (?:dislike|hate)\b/iu.test(clause)) continue;
    if (/不(?:太|再|怎么)?喜欢|不爱|讨厌|厌恶|不想|不喝|不吃|拒绝|避免|\b(?:dislike|hate|avoid|never|do not like|don't like|do not drink|don't drink|not a fan)\b/iu.test(clause)) signs.add('negative');
    else if (/喜欢|喜爱|偏爱|热爱|爱好|更愿意|\b(?:like|love|prefer|enjoy|a fan of)\b/iu.test(clause)) signs.add('positive');
  }
  return signs.size === 1 ? [...signs][0] : null;
}

/** Calendar days use the supplied IANA zone; unknown deadlines remain null. */
export function analyzeLocalTurn(userText, { now, timeZone = 'UTC' } = {}) {
  const text = normalize(userText).slice(0, 64000), clock = nowDate(now);
  const fictional = /(?:假设|假如|设想|如果|倘若|扮演|角色扮演|在故事里|故事中|小说中|在小说里|虚构的|写一个故事|写个故事)|\b(?:if|suppose|hypothetical|imagine|pretend|role[ -]?play|in (?:a|the) story|fictional)\b/iu.test(text);
  const reported = /(?:助手|模型|机器人|AI|ChatGPT)(?:说|称|认为|猜测|回复)|\b(?:the )?(?:assistant|model|chatgpt|bot) (?:said|says|thinks|claimed|claims)\b/iu.test(text);
  const requestOnly = /^(?:请|帮我|能否|可以|你能|你觉得|你喜欢|我该不该|我要不要)|^(?:can you|could you|would you|please|should i|do you)\b/iu.test(text) && !/^(?:请记住|请记录)|^(?:please remember|please note)\b/iu.test(text);
  const question = /[?？]\s*$|(?:吗|是否喜欢|是不是喜欢)\s*[。]?$/u.test(text) || /^(?:what|why|which|who|how|do i|am i|can i)\b/iu.test(text);
  const self = /(?:我|本人|我们)|\b(?:i|my|we|our)\b/iu.test(text);
  const directSelf = /我(?!的|妈|爸|母亲|父亲|朋友|同事|伴侣|丈夫|妻子)|本人|\b(?:i|we)\b/iu.test(text);
  const reliableClaim = Boolean(text) && !fictional && !reported && !requestOnly && !question;
  const preference = (directSelf || /我的(?:偏好|口味)|\bmy (?:preference|favorite|favourite)\b/iu.test(text)) && /喜欢|喜爱|偏爱|偏好|讨厌|不爱|更愿意|口味|\b(?:like|love|prefer|enjoy|dislike|hate|a fan of|preference|favorite|favourite)\b/iu.test(text);
  const habit = (directSelf || /我的习惯|\bmy habit\b/iu.test(text)) && /习惯|每天|每周|通常|总是|经常|从不|\b(?:habit|every day|every morning|every week|usually|always|often|never|regularly)\b/iu.test(text);
  const value = (directSelf || /我的(?:原则|价值观|底线)|\bmy (?:values|principles)\b/iu.test(text)) && /重视|看重|珍视|原则|价值观|底线|\b(?:value|values|believe in|principle|principles|care deeply about)\b/iu.test(text);
  const relationship = /我(?:的)?(?:母亲|父亲|妈妈|爸爸|朋友|同事|伴侣|爱人|丈夫|妻子|男朋友|女朋友)|\bmy (?:friend|colleague|partner|spouse|mother|father|husband|wife|boyfriend|girlfriend)\b/iu.test(text);
  const interest = (directSelf || /我的爱好|\bmy (?:hobby|hobbies)\b/iu.test(text)) && /感兴趣|关注|研究|爱好|\b(?:interested in|interest in|researching|hobby|hobbies)\b/iu.test(text);
  const commitment = directSelf && /(?:我|我们).{0,16}(?:答应|承诺|保证|计划|打算|准备|将会|会在|会明天|会后天|会下周)|(?:我|我们)(?:明天|后天|下周|下个月|\d{1,2}月\d{1,2}日).{0,12}(?:会|要|提交|参加|完成|去)|\b(?:i|we)\s+(?:will|promise|commit|plan to|intend to|am going to|are going to)\b|\b(?:i|we)['’]ll\b|\b(?:i['’]m|we['’]re)\s+going to\b/iu.test(text);
  const cancelled = /(?:不|没|没有|取消)(?:再|打算|计划|准备|承诺|答应)|\b(?:won't|will not|do not plan|don't plan|not going to|cancelled|canceled)\b/iu.test(text);
  const explicitFact = self && /我(?:叫|住在|来自|是|在.{1,20}(?:工作|读书|学习)|已经|刚刚|确认)|\b(?:i (?:am|live|work|study|have|completed|finished)|my name is|we have)\b|\bi['’](?:m|ve)\b/iu.test(text);
  let kind = 'episode', profileFacet = null;
  if (reliableClaim) {
    profileFacet = value ? 'value' : habit ? 'habit' : preference ? 'preference' : relationship ? 'relationship' : interest ? 'interest' : null;
    kind = commitment && !cancelled ? 'commitment' : preference ? 'preference' : (explicitFact || relationship || habit || value || interest) ? 'fact' : 'episode';
  }
  const important = reliableClaim && /对我.{0,6}(?:很重要|非常重要)|人生转折|永远(?:记住|不会忘)|最重要|重大突破|里程碑|\b(?:milestone|life[ -]changing|deeply important|very important to me|never forget)\b/iu.test(text) && !/不(?:太|很|是)?重要|并不重要|\bnot important\b/iu.test(text);
  const importance = important ? 0.94 : kind === 'commitment' ? 0.78 : kind === 'preference' ? 0.72 : profileFacet ? 0.7 : kind === 'fact' ? 0.62 : 0.5;
  const matched = concepts(text);
  const semanticKeys = matched.map(([key]) => `concept:${key}`);
  if (reliableClaim) for (const clause of clauses(text)) {
    const polarity = stance(clause);
    if (polarity) for (const [key] of concepts(clause)) semanticKeys.push(`stance:${key}:${polarity}`);
  }
  if (profileFacet) semanticKeys.push(`facet:${profileFacet}`);
  const temporal = reliableClaim ? temporalRange(text, clock, timeZone) : null;
  const statedTime = clockSpec(text), absolute = absoluteTime(text);
  const hasClock = Boolean(statedTime || absolute);
  const clockInstant = absolute ? absolute.instant : temporal?.exactDay ? wallClockInstant(temporal, statedTime, timeZone) : null;
  // A day without a clock time is represented as its end, not an invented hour.
  const dueAt = kind === 'commitment' && temporal?.exactDay ? hasClock ? clockInstant === null ? null : iso(clockInstant) : iso(temporal.to - 1) : null;
  const narrated = /完成|参加|遇到|见到|认识|收到|经历|搬到|搬家|去了|发生|昨天|前天|\b(?:completed|finished|met|went|visited|received|happened|moved|yesterday|was|were)\b/iu.test(text);
  const futurePlan = /计划|打算|准备|将会|今晚|\b(?:plan|intend|tonight|will|going to)\b/iu.test(text);
  const completedToday = /已|刚|了|今早|\b(?:already|earlier today|completed|finished|met|went|received)\b/iu.test(text);
  const eventInstant = hasClock ? clockInstant : temporal?.from;
  const eventAt = kind !== 'commitment' && narrated && !futurePlan && temporal?.exactDay && eventInstant !== null && eventInstant <= clock?.getTime() && temporal.calendarFrom <= temporal.calendarToday && (temporal.calendarFrom < temporal.calendarToday || completedToday) ? iso(eventInstant) : null;
  const caution = fictional ? '包含假设或虚构提示，只保留为非事实经历' : reported ? '包含助手或模型转述，不提取为用户本人的事实' : !reliableClaim ? '请求、问题或空文本不提升为已确认陈述' : '仅按用户自述形成离线规则候选，未经事实核验';
  const dateBasis = absolute ? '文本中的明确 ISO 时区偏移' : `${timeZone} 日历`;
  return { kind, importance, tags: matched.map(([, label]) => label), entities: extractEntities(text), fictional, dueAt, eventAt, profileFacet, semanticKeys: unique(semanticKeys), reason: `${caution}${profileFacet ? `；${FACET_LABELS[profileFacet]}为可修正分类` : ''}${dueAt ? `；日期按 ${dateBasis}解析，${hasClock ? '使用明确时刻' : '未提供时刻时取所选时区日末'}` : ''}${eventAt ? `；经历日期按 ${dateBasis}解析，${hasClock ? '使用明确时刻' : '仅有日期时以该日开始表示日期粒度'}` : ''}${hasClock && temporal && clockInstant === null ? '；时刻无效或存在夏令时歧义，未自动确定时间' : ''}。` };
}

function lexicalTokens(text) {
  const tokens = [];
  for (const match of normalize(text).toLowerCase().matchAll(/[a-z][a-z0-9_-]{1,}|[\p{Script=Han}]+/gu)) {
    if (/\p{Script=Han}/u.test(match[0])) for (let i = 0; i < match[0].length - 1; i++) tokens.push(match[0].slice(i, i + 2));
    else tokens.push(match[0]);
  }
  return new Set(tokens);
}

/** Finite bilingual concept expansion, not general semantic embeddings. */
export function semanticSimilarity(query, memory) {
  const queryText = normalize(query);
  if (!queryText || memory?.fictional) return 0;
  const memoryText = typeof memory === 'string' ? memory : [memory?.title, memory?.content, ...(Array.isArray(memory?.tags) ? memory.tags : []), ...(Array.isArray(memory?.entities) ? memory.entities : [])].filter(Boolean).join(' ');
  if (!memoryText) return 0;
  const queryKeys = new Set(concepts(queryText).map(([key]) => `concept:${key}`));
  const memoryKeys = new Set([...concepts(memoryText).map(([key]) => `concept:${key}`), ...(Array.isArray(memory?.semanticKeys) ? memory.semanticKeys.filter(key => typeof key === 'string') : [])]);
  const common = [...queryKeys].filter(key => memoryKeys.has(key)).length;
  const conceptScore = queryKeys.size ? common / queryKeys.size : 0;
  const queryTokens = lexicalTokens(queryText), memoryTokens = lexicalTokens(memoryText);
  const lexicalScore = queryTokens.size ? [...queryTokens].filter(token => memoryTokens.has(token)).length / queryTokens.size : 0;
  let score = common ? 0.75 * conceptScore + 0.25 * lexicalScore : 0.45 * lexicalScore;
  const queryStance = stance(queryText), memoryStance = stance(typeof memory === 'string' ? memory : memory.content ?? '');
  if (queryStance && memoryStance && queryStance !== memoryStance) score *= 0.3;
  return Math.round(Math.max(0, Math.min(1, score)) * 10000) / 10000;
}

/** Extractive synthesis: all retained claims keep explicit evidence references. */
export function summarizeEvidence(memories) {
  const items = (Array.isArray(memories) ? memories : []).filter(memory => memory && typeof memory.id === 'string' && memory.id && typeof memory.content === 'string' && memory.content.trim() && !memory.fictional).slice(0, 20);
  if (!items.length) return '没有带稳定 ID 的可用非虚构证据，无法生成可核对归纳。';
  const groups = new Map(), topicSources = new Map();
  for (const memory of items) {
    const text = normalize(memory.content);
    if (!groups.has(text)) groups.set(text, []);
    groups.get(text).push(memory.id);
    for (const [, label] of concepts(text)) {
      if (!topicSources.has(label)) topicSources.set(label, []);
      topicSources.get(label).push(memory.id);
    }
  }
  const shared = [...topicSources].filter(([, ids]) => unique(ids).length >= 2).slice(0, 6);
  const lines = ['离线提取式归纳：以下均为来源陈述，未核验真伪，也不自动消解分歧。'];
  if (shared.length) lines.push(`共同涉及：${shared.map(([label, ids]) => `${label}（${unique(ids).map(id => `[${id}]`).join('、')}）`).join('；')}。`);
  for (const [text, ids] of groups) {
    const points = Array.from(text);
    const excerpt = points.length > 260 ? `${points.slice(0, 260).join('')}…（摘录；完整原文见来源）` : text;
    lines.push(`- ${ids.map(id => `[${id}]`).join('、')} ${excerpt}`);
  }
  if (new Set(items.map(memory => stance(memory.content)).filter(Boolean)).size > 1) lines.push('这些来源包含不同取向的表达；应结合对象、条件和时间人工核对，不能据此判定哪条为真。');
  return lines.join('\n');
}

export function moodGuidance(values = {}) {
  const dimensions = [
    ['joy', '喜悦', '可以适度积极地表达，同时保留事实核对'],
    ['sadness', '忧伤', '使用平缓、体谅的措辞，不据此推断用户也处于忧伤状态'],
    ['fear', '恐惧', '优先说明相关的不确定性和可核实条件，不夸大风险'],
    ['anger', '愤怒', '放慢语气，避免责备、惩罚或争辩'],
    ['disgust', '厌恶', '保持中性措辞，不将模拟感受变成人身或道德评判'],
    ['curiosity', '好奇', '关注与当前任务有关的信息缺口，避免无关追问'],
  ];
  const active = dimensions.map(([key, label, guidance]) => ({ label, guidance, value: typeof values?.[key] === 'number' && Number.isFinite(values[key]) ? Math.max(0, Math.min(1, values[key])) : 0 })).filter(item => item.value >= 0.2).sort((a, b) => b.value - a.value).slice(0, 3);
  const advice = active.length ? active.map(item => `${item.label} ${item.value.toFixed(2)}：${item.guidance}`).join('；') : '状态接近基线，按当前请求清楚、平稳地回答';
  return `模拟状态的表达与注意建议：${advice}。这些建议不改变事实、用户目标、工具权限或外发授权。`;
}

/** Inclusive from / exclusive to, UTC ISO for local days; recent is 7 local days. */
export function inferQueryFilters(query, now, timeZone = 'UTC') {
  const text = normalize(query), range = temporalRange(text, nowDate(now), timeZone);
  const entity = extractEntities(text)[0];
  return { ...(range ? { from: iso(range.from), to: iso(range.to) } : {}), ...(entity ? { entity } : {}) };
}
