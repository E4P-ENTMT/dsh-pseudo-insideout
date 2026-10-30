import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const error = message => { throw Object.assign(new Error(message), { code: 'INVALID_IMPORT_FILE' }); };
const text = value => typeof value === 'string' ? value : Array.isArray(value) ? value.filter(v => v?.type === 'text' && typeof v.text === 'string').map(v => v.text).join('\n') : '';

/** Parse only user-selected UTF-8 data; never interpret paths, HTML or commands. */
export function parseImportFile(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) error('请选择要导入的文件');
  if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 240 || /[\\/\u0000-\u001f]/.test(file.name)) error('只接受文件名，不接受本机路径');
  if (!['json', 'txt', 'md'].includes(file.format) || typeof file.content !== 'string' || !file.content.trim()) error('支持非空 JSON、TXT 或 Markdown 文本');
  if (Buffer.byteLength(file.content, 'utf8') > 512 * 1024) error('单个文件最多512 KiB，请分成多个文件导入');
  const content = file.content;
  const fileHash = hash(content), entries = [];
  const add = (body, original, metadata = {}) => {
    if (typeof body !== 'string' || !body.trim()) error('每条记录必须包含非空 content 或 text');
    if (body.length > 64000 || original.length > 262144) error('JSON单条记录过大：正文最多64000字符，原始记录最多262144字符');
    const index = entries.length;
    entries.push({ key: `file:${fileHash}:${index}`, content: body, original, metadata, sourceFingerprint: hash(JSON.stringify([fileHash, index, body, original, metadata])) });
  };
  if (file.format !== 'json') {
    // Exact contiguous chunks retain every character, including whitespace.
    for (let offset = 0; offset < content.length;) {
      let end = Math.min(content.length, offset + 60000);
      if (end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1])) end--;
      const part = content.slice(offset, end);
      add(part.trim() ? part : `[空白文本片段]\n${part}`, part, { title: content.length > 60000 ? `${file.name} · 第${entries.length + 1}段` : file.name });
      offset = end;
    }
  } else {
    let value;
    try { value = JSON.parse(content.replace(/^\uFEFF/, '')); } catch { error('JSON格式无效，请检查后重试'); }
    if (value && !Array.isArray(value) && Array.isArray(value.messages)) {
      if (value.messages.length > 2000) error('聊天JSON最多2000条消息，请分批导入');
      for (const message of value.messages) {
        if (!message || !['user', 'assistant'].includes(message.role)) continue;
        const body = text(message.content); if (!body.trim()) continue;
        add(`${message.role === 'user' ? '文件中的用户消息' : '文件中的助手消息'}：${body}`, JSON.stringify(message), { title: `${file.name} · ${message.role === 'user' ? '用户消息' : '助手消息'}`, fictional: message.role === 'assistant', claimedRole: message.role });
      }
    } else {
      const records = Array.isArray(value) ? value : value && (Array.isArray(value.memories) ? value.memories : Array.isArray(value.records) ? value.records : [value]);
      if (!Array.isArray(records) || !records.length || records.length > 2000) error('JSON需为记录、记录数组、memories/records数组或messages数组，最多2000项');
      for (const record of records) {
        if (typeof record === 'string') { add(record, JSON.stringify(record), {}); continue; }
        if (!record || typeof record !== 'object' || Array.isArray(record)) error('JSON记录必须为对象或文本');
        const metadata = {};
        for (const key of ['title', 'kind', 'eventAt', 'importance', 'tags', 'entities', 'fictional']) if (record[key] !== undefined) metadata[key] = record[key];
        add(text(record.content ?? record.text), JSON.stringify(record), metadata);
      }
    }
    if (!entries.length) error('JSON中没有可导入的文本记录');
  }
  return { entries, sourceInfo: { name: file.name, format: file.format, fileHash, bytes: Buffer.byteLength(content, 'utf8'), recordCount: entries.length }, sourceSignature: fileHash };
}
