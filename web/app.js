/* dsh-pseudo-insideout · zero-build control console */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const main = $('#main');
  const modal = $('#modal');
  const ICONS = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/>',
    memory: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M5 5 3 3m16 16 2 2M19 5l2-2M5 19l-2 2"/>',
    archive: '<path d="M4 8h16v12H4zM3 3h18v5H3zM9 12h6"/>',
    island: '<path d="M4 18 9 8l4 6 3-4 5 8ZM7 21h11M9 8V3m0 0 5 2-5 2"/>',
    dream: '<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/><path d="M17 2v4m-2-2h4m1 4v3m-1.5-1.5h3"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-3-1-2-2Z"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.2 8a7 7 0 0 1 11.5-3L20 8M4 16l3.3 3A7 7 0 0 0 18.8 16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    core: '<path d="m12 3 2.8 5.7L21 9.6l-4.5 4.5 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.6l6.2-.9Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pulse: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-4-4L5 15Z"/>',
    restore: '<path d="M3 10h6M3 10V4m0 6a9 9 0 1 1 2 9"/><path d="M12 7v6l4 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    link: '<path d="m9 15 6-6m-8 4-2 2a3 3 0 0 0 4 4l3-3m0-8 3-3a3 3 0 0 1 4 4l-2 2"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    document: '<path d="M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8M8 17h6"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m7 4 13 8-13 8Z"/>',
  };
  const pages = [
    { id: 'home', label: '总部', icon: 'home', en: 'HEADQUARTERS' },
    { id: 'memories', label: '记忆大厅', icon: 'memory', en: 'MEMORY HALL' },
    { id: 'archive', label: '封存档案馆', icon: 'archive', en: 'THE ARCHIVE' },
    { id: 'islands', label: '人格岛', icon: 'island', en: 'PERSONALITY ISLANDS' },
    { id: 'dreams', label: '梦工坊', icon: 'dream', en: 'DREAM WORKSHOP' },
    { id: 'system', label: '运行与设置', icon: 'settings', en: 'SYSTEM & SETTINGS' },
  ];
  const emotions = [
    { id: 'joy', label: '喜悦', color: 'var(--joy)', face: '◡' },
    { id: 'sadness', label: '忧伤', color: 'var(--sadness)', face: '◠' },
    { id: 'fear', label: '恐惧', color: 'var(--fear)', face: '○' },
    { id: 'anger', label: '愤怒', color: 'var(--anger)', face: '⌁' },
    { id: 'disgust', label: '厌恶', color: 'var(--disgust)', face: '∼' },
    { id: 'curiosity', label: '好奇', color: 'var(--curiosity)', face: '✧' },
  ];
  const kinds = { episode: '经历', fact: '事实', preference: '偏好', commitment: '约定', reflection: '反思' };
  const sources = { user: '用户陈述', observed: '直接观察', assistant: '助手生成', import: '手动导入', model: '模型分析' };
  const facets = { preference: '偏好', relationship: '关系', habit: '习惯', value: '价值取向', interest: '兴趣主题' };
  const subjects = { user: '用户倾向', agent: 'Agent 倾向', world: '外部事实' };
  const dreamTypes = { archive: '封存建议', summary: '归纳记忆', association: '经历关联', core: '核心记忆', island: '人格岛', followup: '关怀建议', conflict: '矛盾待核对' };
  const statuses = { pending: '待审核', approved: '已批准', rejected: '已拒绝', stale: '证据已变化' };
  const actionNames = {
    'memory.created': '创建记忆', 'memory.updated': '修订记忆', 'memory.archived': '封存记忆',
    'memory.restored': '恢复活跃', 'memory.deleted': '明确删除', 'memory.interpreted': '添加新理解',
    'recall.requested': '申请临时调阅', 'recall.consumed': '消费调阅授权', 'context.built': '构建上下文',
    'dream.run': '运行梦工坊', 'dream.approved': '批准建议', 'dream.rejected': '拒绝建议',
    'config.updated': '更新配置', 'island.updated': '编辑人格岛', 'turn.completed': '完成回合',
    'memory.revised': '修订记忆', 'archive.recall-authorized': '授权临时调阅',
    'turn.captured': '捕获对话经历', 'turn.capture-skipped': '跳过新记忆捕获',
    'emotion.updated': '更新情绪状态', 'emotion.analysis-invalid': '拒绝无效情绪分析', 'dream.completed': '完成后台整理',
    'emotion.reset': '重置当前情绪', 'workspace.updated': '更新会话工作台', 'memory.trashed': '移入回收箱', 'memory.untrashed': '从回收箱恢复', 'created': '形成新的人格岛', 'user-edited': '用户修订人格岛', 'user-reverted': '恢复人格历史版本', 'proposal-approved': '批准成长提案',
    'memory.default-updated': '更新默认记忆开关', 'memory.session-policy-updated': '更新会话记忆开关', 'imports.committed': '执行显式导入',
  };
  let boot;
  let page = route();
  let state = null;
  let pageData = {};
  let loadVersion = 0;
  let view = 'orbs';
  let query = '';
  let kindFilter = '';
  let emotionFilter = '';
  let fromFilter = '';
  let toFilter = '';
  let entityFilter = '';
  let archiveTab = 'archive';
  let sessionId = '';
  let selectedMemories = new Map();
  let selectedIsland = '';
  let dreamRunning = false;
  let systemTab = 'settings';
  let dreamFilter = 'pending';
  let fieldCounter = 0;
  let scopeId = '';
  let scopeEpoch = 0;
  let importFlow = null;
  const pageSize = 50;
  let memoryOffset = 0;
  let coreOffset = 0;

  function h(tag, props, ...children) {
    const element = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') element.className = value;
      else if (key === 'style' && typeof value === 'object') Object.entries(value).forEach(([k, v]) => element.style.setProperty(k, v));
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'checked') element.checked = !!value;
      else if (key === 'value') { /* Assign after min/max/step and select options exist. */ }
      else if (value === true) element.setAttribute(key, '');
      else element.setAttribute(key, String(value));
    });
    const append = child => {
      if (Array.isArray(child)) child.forEach(append);
      else if (child instanceof Node) element.append(child);
      else if (child !== undefined && child !== null && child !== false) element.append(document.createTextNode(String(child)));
    };
    children.forEach(append);
    if (props?.value !== undefined && props?.value !== null) element.value = props.value;
    return element;
  }

  function icon(name, size = 18) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
    svg.innerHTML = ICONS[name] || ICONS.document; // Only constant, locally defined SVG paths.
    return svg;
  }

  function button(label, onClick, { variant = '', iconName, small = false, type = 'button', ...props } = {}) {
    return h('button', { class: `button ${variant} ${small ? 'small' : ''}`, type, onClick, ...props }, iconName && icon(iconName, 15), label);
  }

  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const shortId = value => typeof value === 'string' && value.length > 18 ? `${value.slice(0, 12)}…${value.slice(-4)}` : value || '—';
  const percent = value => `${Math.round(clamp(value) * 100)}%`;
  function date(value, withTime = false) {
    if (!value || Number.isNaN(new Date(value).getTime())) return '未记录';
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(new Date(value));
  }
  const json = value => JSON.stringify(value, null, 2);
  const split = value => String(value || '').split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
  function route() { return pages.some(item => item.id === location.hash.slice(1)) ? location.hash.slice(1) : 'home'; }
  function go(target) { if (page === target) loadPage(); else location.hash = target; }
  function memoryColor(memory) {
    const ranked = emotions.map(emotion => ({ ...emotion, value: clamp(memory.emotions?.[emotion.id]) })).sort((a, b) => b.value - a.value);
    return ranked[0].value > 0 ? ranked[0].color : memory.core ? 'var(--joy)' : memory.tier === 'archive' ? 'var(--archive-orb)' : 'var(--neutral-orb)';
  }

  function memoryPaint(memory) {
    const active = emotions.map(item => ({ ...item, value: clamp(memory.emotions?.[item.id]) })).filter(item => item.value > 0);
    const total = active.reduce((sum, item) => sum + item.value, 0);
    let edge = 0;
    const stops = active.map(item => { const start = edge; edge += item.value / total * 100; return `${item.color} ${start.toFixed(2)}% ${edge.toFixed(2)}%`; });
    return { '--orb-color': memoryColor(memory), '--orb-mix': stops.length > 1 ? `conic-gradient(from -35deg, ${stops.join(',')})` : `linear-gradient(${memoryColor(memory)},${memoryColor(memory)})` };
  }
  function emotionText(memory) { return emotions.filter(item => clamp(memory.emotions?.[item.id]) > 0).map(item => `${item.label} ${percent(memory.emotions[item.id])}`).join(' · ') || '未标记情绪'; }
  function dateInput(value) { return value ? String(value).slice(0, 10) : ''; }
  function clearSelection() { selectedMemories = new Map(); }

  async function api(path, options = {}) {
    if (!boot?.token) throw new Error('控制台缺少宿主注入的连接凭据。请从 DSH 插件或本地服务入口打开此页面。');
    const requestEpoch = scopeEpoch;
    const response = await fetch(`${boot.apiBase || '/api/pseudo-insideout/v1'}${path}`, {
      method: options.method || 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-InsideOut-Token': boot.token, ...(scopeId ? { 'X-InsideOut-Scope': scopeId } : {}), ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    let result;
    try { result = await response.json(); } catch { throw new Error(`服务返回了无法读取的响应（${response.status}）。请检查插件服务。`); }
    if (requestEpoch !== scopeEpoch) { const error = new Error('数据范围已经切换，旧请求结果已丢弃。'); error.code = 'SCOPE_CHANGED'; throw error; }
    if (!response.ok) {
      const error = new Error(result.error?.message || result.error || `请求失败（${response.status}）`);
      error.code = result.error?.code;
      error.status = response.status;
      throw error;
    }
    if (result && typeof result === 'object') {
      Object.defineProperty(result, '__scopeEpoch', { value: requestEpoch, enumerable: false });
      if (result.memory && typeof result.memory === 'object') Object.defineProperty(result.memory, '__scopeEpoch', { value: requestEpoch, enumerable: false });
    }
    return result;
  }

  function toast(message, error = false) {
    const item = h('div', { class: `toast ${error ? 'error' : ''}`, role: error ? 'alert' : 'status' }, icon(error ? 'info' : 'check', 17), h('span', {}, message));
    item.append(h('button', { type: 'button', 'aria-label': '关闭通知', onClick: () => item.remove() }, icon('close', 15)));
    $('#toast-region').append(item);
    setTimeout(() => item.remove(), error ? 12000 : 6500);
  }

  async function action(element, task, successMessage) {
    if (element.disabled) return;
    element.disabled = true;
    try {
      const result = await task();
      if (successMessage) toast(successMessage);
      return result;
    } catch (error) { if (error.code !== 'SCOPE_CHANGED') toast(error.message, true); return undefined; }
    finally { if (element.isConnected) element.disabled = false; }
  }

  function navigation() {
    $('#navigation').replaceChildren(...pages.map((item, index) => h('a', {
      class: `nav-item ${item.id === page ? 'active' : ''}`, href: `#${item.id}`, ...(item.id === page ? { 'aria-current': 'page' } : {}),
    }, icon(item.icon, 17), item.label, h('span', { class: 'nav-index' }, String(index + 1).padStart(2, '0')))));
    $('#breadcrumb-title').textContent = pages.find(item => item.id === page).label;
    document.title = `${pages.find(item => item.id === page).label} · InsideOut`;
  }

  function updateStatus(failed = false) {
    const status = $('#connection-status');
    const connected = state?.runtime?.connected === true;
    status.className = `status-pill ${failed ? 'error' : connected ? 'connected' : ''}`;
    status.replaceChildren(h('i'), failed ? '控制台连接失败' : connected ? 'DSH 会话已连接' : '未连接 DSH 会话');
    status.title = state?.runtime?.mode === 'standalone' ? '独立控制台可管理记忆；尚未接入 DSH 对话。' : connected ? '运行状态由宿主返回。' : '当前没有已确认的 DSH 会话连接。';
  }

  function updateScopes() {
    const select = $('#scope-select');
    const scopes = state?.scopes || [];
    select.replaceChildren(...(scopes.length ? scopes.map(scope => h('option', { value: scope.id }, scope.label || `${scope.workspaceId || '工作区'} / ${scope.agentId || 'Agent'}`)) : [h('option', { value: scopeId }, state?.runtime?.mode === 'standalone' ? '当前独立数据范围' : '当前工作区 / Agent')]));
    select.value = scopeId;
    select.disabled = scopes.length < 2;
  }

  async function loadPage({ silent = false } = {}) {
    const version = ++loadVersion;
    page = route();
    navigation();
    if (!silent) main.replaceChildren(h('div', { class: 'initial-loading' }, h('span', { class: 'loading-dot' }), '正在读取真实数据…'));
    const refresh = $('#refresh-button');
    refresh.disabled = true;
    try {
      const nextState = await api('/state');
      if (version !== loadVersion) return;
      if (!scopeId && nextState.runtime?.scopeId) scopeId = nextState.runtime.scopeId;
      if (!sessionId) sessionId = nextState.sessions?.[0]?.id || 'manual';
      const filters = { tier: page === 'archive' ? 'archive' : 'active', q: query, ...(kindFilter ? { kind: kindFilter } : {}), ...(emotionFilter ? { emotion: emotionFilter } : {}), ...(entityFilter ? { entity: entityFilter } : {}), ...(fromFilter ? { from: `${fromFilter}T00:00:00+08:00` } : {}), ...(toFilter ? { to: new Date(Date.parse(`${toFilter}T00:00:00+08:00`) + 86_400_000).toISOString() } : {}), ...(page === 'archive' && archiveTab === 'trash' ? { trashed: 'true' } : {}), offset: String(memoryOffset), limit: String(pageSize) };
      const endpoint = page === 'home' ? ['/memories?tier=active&limit=100', '/logs?limit=5', `/workspace?sessionId=${encodeURIComponent(sessionId)}`, `/recalls?sessionId=${encodeURIComponent(sessionId)}`, '/memory-default', `/session-memory?sessionId=${encodeURIComponent(sessionId)}`]
        : page === 'memories' || page === 'archive' ? [`/memories?${new URLSearchParams(filters)}`]
          : page === 'dreams' ? ['/dreams'] : page === 'islands' ? ['/islands', `/memories?tier=active&core=true&offset=${coreOffset}&limit=${pageSize}`, '/growth'] : ['/config', '/logs?limit=100', `/recalls?sessionId=${encodeURIComponent(sessionId)}`, '/memory-default', `/session-memory?sessionId=${encodeURIComponent(sessionId)}`];
      const results = await Promise.all(endpoint.map(path => api(path)));
      if (version !== loadVersion) return;
      const evidenceById = {};
      if (page === 'islands') {
        const ids = [...new Set((results[0]?.items || []).flatMap(island => island.evidenceIds || []))];
        for (let offset = 0; offset < ids.length; offset += 12) {
          await Promise.all(ids.slice(offset, offset + 12).map(async id => { try { evidenceById[id] = await api(`/memories/${encodeURIComponent(id)}?tier=active`); } catch (error) { if (error.code === 'SCOPE_CHANGED') throw error; evidenceById[id] = { id, unavailable: true }; } }));
          if (version !== loadVersion) return;
        }
      }
      state = nextState;
      pageData = { primary: results[0], secondary: results[1], workspace: page === 'home' ? results[2] : null, recalls: page === 'home' ? results[3] : page === 'system' ? results[2] : null, memoryDefault: page === 'home' ? results[4] : page === 'system' ? results[3] : null, sessionMemory: page === 'home' ? results[5] : page === 'system' ? results[4] : null, growth: page === 'islands' ? results[2] : null, evidenceById };
      if ((page === 'memories' || page === 'archive') && memoryOffset > 0 && memoryOffset >= (pageData.primary?.total || 0)) {
        memoryOffset = Math.floor(Math.max(0, (pageData.primary?.total || 0) - 1) / pageSize) * pageSize;
        await loadPage({ silent: true }); return;
      }
      if (page === 'islands' && coreOffset > 0 && coreOffset >= (pageData.secondary?.total || 0)) {
        coreOffset = Math.floor(Math.max(0, (pageData.secondary?.total || 0) - 1) / pageSize) * pageSize;
        await loadPage({ silent: true }); return;
      }
      updateStatus();
      updateScopes();
      $('#last-updated').textContent = `本地数据 · 更新于 ${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}（上海）`;
      renderPage();
    } catch (error) {
      if (version !== loadVersion) return;
      updateStatus(true);
      main.replaceChildren(h('div', { class: 'error-page' }, heading('控制台暂不可用', '没有使用缓存或演示数据替代这次读取。'), info(error.message, 'error'), button('重新连接', () => loadPage(), { variant: 'primary', iconName: 'refresh' })));
    } finally { if (version === loadVersion) refresh.disabled = false; }
  }

  function renderPage() {
    const renderer = { home: renderHome, memories: () => renderMemories(false), archive: () => renderMemories(true), islands: renderIslands, dreams: renderDreams, system: renderSystem }[page];
    const issues = state.storage?.issues || [];
    const content = renderer();
    if (!issues.length) main.replaceChildren(content);
    else main.replaceChildren(h('section', { class: 'storage-issues', role: 'status', 'aria-label': '数据完整性提示' }, info('部分存储记录需要检查。其他可用内容仍可浏览；此提示不会删除或覆盖记录。', 'warn', '数据问题'), h('details', {}, h('summary', {}, `查看 ${issues.length} 项数据问题`), issues.map(issue => h('div', { class: 'storage-issue-item' }, h('p', {}, issue.message || issue.code), h('p', { class: 'mono' }, `代码：${issue.code || 'UNKNOWN'}`), h('p', { class: 'mono' }, `记录 ID：${(issue.ids || []).join('、') || '未提供'}`))))), content);
  }

  function heading(title, description, actions = []) {
    return h('div', { class: 'page-heading' }, h('div', {}, h('div', { class: 'eyebrow' }, pages.find(item => item.id === page)?.en || 'INSIDEOUT'), h('h1', {}, title), h('p', {}, description)), h('div', { class: 'heading-actions' }, actions));
  }
  function info(text, variant = '', title = '') { return h('div', { class: `info-strip ${variant}` }, icon(variant === 'error' || variant === 'warn' ? 'info' : 'shield', 18), h('div', {}, title && h('strong', {}, `${title} `), text)); }
  function tag(text, variant = '') { return h('span', { class: `tag ${variant}` }, text); }
  function empty(title, description, iconName = 'memory', actionButton) { return h('div', { class: 'empty-state' }, icon(iconName, 32), h('h3', {}, title), h('p', {}, description), actionButton); }
  function panel(title, subtitle, content, extra, footer) { return h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, title), subtitle && h('p', { class: 'panel-subtitle' }, subtitle)), extra), h('div', { class: 'panel-body' }, content), footer && h('div', { class: 'panel-footer' }, footer)); }

  function sessionPicker() {
    const listId = `session-list-${++fieldCounter}`;
    const input = h('input', { class: 'input', name: 'session', value: sessionId, list: listId, required: true, maxlength: 200, 'aria-label': '工作台与回应依据的会话 ID' });
    return h('form', { class: 'session-picker', onSubmit: event => { event.preventDefault(); const value = input.value.trim(); if (!value) return; sessionId = value; if (modal.open) modal.close(); loadPage(); } }, h('label', {}, '会话', input), h('datalist', { id: listId }, (state.sessions || []).map(session => h('option', { value: session.id }, session.id))), button('切换会话', null, { type: 'submit', small: true }), h('span', { class: 'muted' }, '可选择已有会话或填写手动会话 ID；手动工作台不代表已连接 DSH。'));
  }

  function memoryPolicyStatus(policy) {
    if (!policy) return info('尚未取得此会话的记忆开关状态。', 'warn');
    const origin = policy.scopeEnabled === false ? '此记忆空间已暂停，优先于会话设置'
      : policy.override === 'on' ? '来自本会话的开启设置'
        : policy.override === 'off' ? '来自本会话的关闭设置'
          : `继承默认：${policy.defaultEnabled ? '开启' : '关闭'}`;
    return h('div', { class: 'memory-policy-status', role: 'status' }, tag(`当前生效：${policy.effectiveEnabled ? '开启' : '关闭'}`, policy.effectiveEnabled ? 'green' : ''), h('span', {}, origin));
  }

  function memoryDefaultPanel() {
    const setting = pageData.memoryDefault;
    if (!setting) return info('默认记忆开关暂不可用。', 'warn');
    const form = h('form', { class: 'memory-default-form' });
    const scopeText = setting.scope === 'profile' ? '作用于当前 DSH profile 的所有记忆空间，仅影响选择“继承默认”的会话。'
      : '当前为独立控制台；此默认值只作用于当前数据目录，仅影响选择“继承默认”的会话。';
    const submit = button('保存默认开关', null, { type: 'submit', variant: 'primary', small: true, iconName: 'check' });
    form.append(toggle('默认启用会话记忆', 'defaultEnabled', setting.enabled, scopeText), h('div', { class: 'policy-save-row' }, h('p', { class: 'panel-subtitle' }, '不会删除既有记录，也不会更改各会话的独立设置。'), submit));
    wireForm(form, submit, async data => {
      await api('/memory-default', { method: 'PATCH', body: { expectedVersion: setting.version, enabled: data.get('defaultEnabled') === 'on' } });
      toast('默认记忆开关已保存；独立设置的会话保持原设置。');
      await loadPage({ silent: true });
    });
    return panel('默认记忆开关', setting.scope === 'profile' ? '当前 DSH profile' : '当前独立数据目录', form);
  }

  function sessionMemoryForm() {
    const policy = pageData.sessionMemory;
    if (!policy) return info('此会话的记忆开关暂不可用。', 'warn');
    const targetSessionId = sessionId;
    const form = h('form', { class: 'session-memory-form' });
    const options = [['inherit', `继承默认（${policy.defaultEnabled ? '开启' : '关闭'}）`], ['on', '本会话开启'], ['off', '本会话关闭']];
    const choices = h('fieldset', { class: 'policy-options' }, h('legend', {}, '会话记忆设置'), options.map(([value, label]) => h('label', { class: 'policy-choice' }, h('input', { type: 'radio', name: 'memoryOverride', value, checked: policy.override === value, required: true }), h('span', {}, label))));
    const submit = button('保存会话记忆设置', null, { type: 'submit', variant: 'primary', small: true, iconName: 'check' });
    form.append(memoryPolicyStatus(policy), choices, h('p', { class: 'panel-subtitle' }, '关闭会停止此会话的自动采集、召回及记忆辅助模型调用。原记录保留，手动管理和导入仍可使用；重新开启后从下个完整回合开始采集。'), h('div', { class: 'policy-save-row' }, h('span', { class: 'panel-subtitle' }, `会话 ${targetSessionId} · v${policy.version}`), submit));
    wireForm(form, submit, async data => {
      await api('/session-memory', { method: 'PATCH', body: { sessionId: targetSessionId, expectedVersion: policy.version, override: data.get('memoryOverride') } });
      toast(`会话 ${targetSessionId} 的记忆设置已保存。已有记忆保持完整。`);
      await loadPage({ silent: true });
    });
    return form;
  }

  function workspacePanel() {
    const workspace = pageData.workspace || { version: 0, goals: [], focus: [], energy: 0.5, pinnedMemoryIds: [] };
    const form = h('form', { class: 'workspace-form' });
    const goals = h('div', { class: 'goal-list' });
    const addGoal = (goal = {}) => {
      const row = h('div', { class: 'goal-row', 'data-goal-id': goal.id || `goal-${crypto.randomUUID()}` },
        field('目标', 'goalText', goal.text || '', { required: true, maxlength: 300, placeholder: '当前要完成的事' }),
        field('状态', 'goalStatus', goal.status || 'active', { type: 'select', choices: [{ value: 'active', label: '进行中' }, { value: 'done', label: '已完成' }] }),
        field('目标日期', 'goalDue', dateInput(goal.dueAt), { type: 'date' }), button('移除', () => row.remove(), { small: true, variant: 'subtle', 'aria-label': '移除这个目标' }));
      goals.append(row);
    };
    (workspace.goals || []).forEach(addGoal);
    const pinned = new Set(workspace.pinnedMemoryIds || []);
    const pins = h('div', { class: 'pinned-list' });
    const drawPins = () => { pins.replaceChildren(...[...pinned].map(id => h('div', { class: 'pinned-item' }, button((workspace.pinnedMemories || []).find(item => item.id === id)?.title || shortId(id), () => openMemory(id), { variant: 'subtle', small: true, iconName: 'memory' }), button('移出', () => { pinned.delete(id); drawPins(); }, { small: true, 'aria-label': `从工作记忆移出 ${id}` })))); if (!pinned.size) pins.append(h('p', { class: 'panel-subtitle' }, '在活跃记忆详情中选择“加入工作记忆”。最多 12 条，仍受本轮召回预算约束。')); };
    drawPins();
    const submit = button('保存会话工作台', null, { type: 'submit', variant: 'primary', iconName: 'check' });
    form.append(h('div', { class: 'workspace-heading' }, h('h3', {}, '当前目标'), button('添加目标', () => addGoal(), { small: true, iconName: 'plus' })), goals,
      h('div', { class: 'form-grid workspace-fields' }, field('关注的人与事', 'focus', (workspace.focus || []).join('\n'), { type: 'textarea', rows: 3, maxlength: 4000, hint: '每行一项，帮助本会话分配注意。' }), field('精力（0–1）', 'energy', workspace.energy ?? 0.5, { type: 'range', min: 0, max: 1, step: 0.05, hint: '模拟当前可用精力，不代表人的心理诊断。' })), h('h3', {}, '工作记忆'), pins,
      h('div', { class: 'save-bar' }, h('span', {}, `会话 ${sessionId} · v${workspace.version || 0}${workspace.updatedAt ? ` · ${date(workspace.updatedAt, true)}` : ' · 尚未保存'}`), submit));
    const energy = form.elements.energy;
    const energyValue = h('output', { class: 'energy-value', for: energy.id }, percent(energy.value));
    energy.after(energyValue); energy.addEventListener('input', () => { energyValue.textContent = percent(energy.value); });
    wireForm(form, submit, async data => {
      const nextGoals = [...goals.children].map(row => ({ id: row.dataset.goalId, text: $('[name=goalText]', row).value.trim(), status: $('[name=goalStatus]', row).value, dueAt: $('[name=goalDue]', row).value ? `${$('[name=goalDue]', row).value}T23:59:59+08:00` : null }));
      await api(`/workspace?sessionId=${encodeURIComponent(sessionId)}`, { method: 'PATCH', body: { sessionId, expectedVersion: workspace.version || 0, goals: nextGoals, focus: String(data.get('focus') || '').split('\n').map(value => value.trim()).filter(Boolean), energy: Number(data.get('energy')), pinnedMemoryIds: [...pinned] } });
      toast('会话工作台已保存，后续召回使用新的目标与关注点。'); await loadPage({ silent: true });
    });
    return panel('会话工作台', '目标、关注点与工作记忆一起决定此刻的注意范围', h('div', {}, sessionPicker(), sessionMemoryForm(), h('div', { class: 'workspace-import-entry' }, button('导入到此会话', () => startImport({ targetSessionId: sessionId }), { small: true, iconName: 'plus' }), h('span', {}, '选择来源、核对记录后执行；不会更改此会话的记忆开关。')), form));
  }

  const detailLabels = { title: '名称', description: '说明', facet: '结构类型', subject: '信息归属', enabled: '参与上下文', goals: '目标', focus: '关注点', energy: '精力', pinnedMemoryIds: '工作记忆', pinnedMemories: '工作记忆', status: '状态', text: '内容', dueAt: '到期时间', id: 'ID', values: '情绪值', confidence: '置信度', reason: '原因', updatedAt: '更新时间', persona: '人格底稿', identity: '身份底稿', guidance: '表达建议', sessionId: '会话', version: '版本', evidenceIds: '支持证据', inputTokens: '输入 token', outputTokens: '输出 token', totalTokens: '总 token', durationMs: '用时（毫秒）', model: '模型', provider: '提供方', phase: '阶段', kind: '类型', cost: '费用', currency: '币种', purpose: '调用用途', inputTotalTokens: '输入合计 token', cacheReadTokens: '缓存读取 token', cacheWriteTokens: '缓存写入 token', at: '记录时间', method: '提炼方式', extraction: '提炼依据', semanticKeys: '检索概念', importance: '重要度', tags: '标签', entities: '人物或实体', profileFacet: '画像结构', eventAt: '发生时间', emotions: '情绪标签', core: '核心记忆' };
  function readable(value) {
    if (value === null || value === undefined || value === '') return h('span', { class: 'muted' }, '未提供');
    if (typeof value === 'boolean') return document.createTextNode(value ? '是' : '否');
    if (typeof value !== 'object') return document.createTextNode(String(value));
    if (Array.isArray(value)) return value.length ? h('ul', { class: 'readable-list' }, value.map(item => h('li', {}, readable(item)))) : h('span', { class: 'muted' }, '无');
    return h('dl', { class: 'readable-data' }, Object.entries(value).filter(([key]) => !key.startsWith('__') && key !== 'evidenceHashes').map(([key, item]) => h('div', {}, h('dt', {}, detailLabels[key] || emotions.find(emotion => emotion.id === key)?.label || key), h('dd', {}, readable(key === 'facet' ? facets[item] || item : key === 'subject' ? subjects[item] || item : item)))));
  }
  function changeView(before, after) { return h('div', { class: 'change-grid' }, h('section', { class: 'change-before' }, h('h4', {}, '处理前'), h('div', { class: 'body-copy' }, readable(before))), h('section', { class: 'change-after' }, h('h4', {}, '处理后'), h('div', { class: 'body-copy' }, readable(after)))); }
  function recallHistory(records, compact = false) {
    if (!records?.length) return empty('此会话尚无回应依据', '完成真实回合后，这里记录入选记忆、未入选原因、当时状态及实际获得的调用用量。', 'eye');
    return h('div', { class: 'recall-history' }, records.map((recall, index) => h('details', { class: 'recall-entry', open: !compact && index === 0 },
      h('summary', {}, `${date(recall.at, true)} · 回合 ${recall.turnId || '未提供'} · ${recall.items?.length || 0} 条记忆 · ${recall.usedChars || 0}/${recall.limitChars || 0} 字符`),
      h('div', { class: 'recall-body' }, h('h3', {}, '进入本轮上下文的记忆'), recall.items?.length ? recall.items.map(item => h('div', { class: 'readout' }, button(item.title || shortId(item.id), () => openMemory(item.id, item.tier || 'active'), { small: true, variant: 'subtle' }), h('span', { class: 'muted' }, (item.reasons || []).join(' · ') || '已纳入上下文'))) : h('p', { class: 'panel-subtitle' }, '本轮未选入记忆。'),
        h('details', {}, h('summary', {}, `未入选候选与原因 · ${recall.excluded?.length || 0}`), recall.excluded?.length ? h('ul', { class: 'readable-list' }, recall.excluded.map(item => h('li', {}, h('span', { class: 'mono' }, item.id || '候选'), ' · ', Array.isArray(item.reasons) ? item.reasons.join(' · ') : item.reason || '未提供原因'))) : h('p', { class: 'panel-subtitle' }, '该回合没有记录未入选候选。')),
        h('details', {}, h('summary', {}, '当时的状态与表达建议'), readable(recall.state || {})),
        h('details', {}, h('summary', {}, `实际调用用量 · ${recall.usage?.length || 0}`), recall.usage?.length ? readable(recall.usage) : h('p', { class: 'panel-subtitle' }, '宿主未提供本轮用量；不估算 token 或费用。'))))));
  }

  function renderHome() {
    const memories = pageData.primary?.items || [];
    const logs = pageData.secondary?.items || [];
    const counts = state.counts || {};
    const root = h('div', {}, heading('每段经历，都有它的位置。', '这里是你的记忆总部。看看正在发生什么，又有哪些值得珍藏。', [button(state.config?.enabled === false ? '恢复此记忆空间' : '暂停此记忆空间', event => action(event.currentTarget, async () => { await api('/config', { method: 'PATCH', body: { enabled: state.config?.enabled === false } }); await loadPage({ silent: true }); }, '此记忆空间的运行状态已保存。'), { iconName: state.config?.enabled === false ? 'play' : 'pause' }), button('新建记忆', () => memoryForm(), { variant: 'primary', iconName: 'plus' })]));
    if (state.config?.enabled === false) root.append(info('此记忆空间已暂停参与对话，优先于会话开关。既有记忆完整保留，手动管理和显式导入仍可使用。', 'warn'));
    const metrics = [
      ['活跃记忆', counts.active, '参与日常召回', 'memory', 'var(--sadness)', 'memories'],
      ['封存记忆', counts.archive, '独立存放，不自动召回', 'archive', 'var(--purple)', 'archive'],
      ['核心记忆', counts.core, '由已批准的经历支撑', 'core', 'var(--gold)', 'islands'],
      ['待审建议', counts.pending, '改变发生前，由你决定', 'dream', 'var(--curiosity)', 'dreams'],
    ];
    root.append(h('div', { class: 'metrics' }, metrics.map(([label, value, help, glyph, color, target]) => h('a', { href: `#${target}`, class: 'metric', style: { '--accent': color }, 'aria-label': `${label} ${value ?? 0}，${help}` }, h('div', { class: 'metric-top' }, label, icon(glyph, 17)), h('div', { class: 'metric-value' }, value ?? 0), h('div', { class: 'metric-bottom' }, help), h('div', { class: 'metric-edge' })))));

    const field = h('div', { class: 'orb-field', 'aria-label': '活跃记忆球' });
    const chosen = [...memories].sort((a, b) => Number(b.core) - Number(a.core) || Number(b.importance) - Number(a.importance)).slice(0, 7);
    const positions = [[50, 42], [24, 30], [77, 29], [30, 69], [74, 70], [11, 56], [91, 55]];
    if (!chosen.length) field.append(h('div', { class: 'orb-empty' }, h('div', { class: 'orb-empty-circle' }, icon('plus', 24)), h('p', {}, '第一颗记忆，等待被点亮'), h('small', {}, '创建一条记忆，或接入 DSH 后开始对话。')));
    chosen.forEach((memory, index) => field.append(h('button', { class: 'memory-orb', type: 'button', 'aria-label': `查看记忆：${memory.title}，${emotionText(memory)}`, onClick: () => openMemory(memory.id, 'active'), style: { left: `${positions[index][0]}%`, top: `${positions[index][1]}%`, '--size': `${42 + clamp(memory.importance) * 30}px`, ...memoryPaint(memory) } }, h('span', { class: 'orb' }, icon(memory.core ? 'core' : memory.kind === 'commitment' ? 'link' : 'spark', memory.core ? 22 : 17)), h('span', { class: 'orb-label' }, memory.title), h('span', { class: 'orb-kind' }, memory.core ? '核心记忆' : kinds[memory.kind] || memory.kind))));
    field.append(h('span', { class: 'orbit-caption' }, chosen.length ? '球体大小 · 重要度　 /　 混色占比 · 各维情绪' : '没有虚构的记忆，没有被丢弃的经历'));
    const memoryPanel = h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, '记忆星图'), h('p', { class: 'panel-subtitle' }, `活跃库中 ${chosen.length} 段值得关注的经历`)), h('a', { class: 'text-button', href: '#memories' }, '查看全部', icon('arrow', 13))), field, h('div', { class: 'panel-footer' }, h('div', { class: 'legend' }, emotions.map(item => { return h('span', {}, h('i', { style: { '--accent': item.color } }), item.label); })), h('span', {}, '点击记忆球，查看原文')));

    const emotion = state.emotion || {};
    const emotionPanel = panel('情绪控制台', '模拟状态 · 随时间自然回落', h('div', {}, h('div', { class: 'emotion-list' }, emotions.map(item => h('button', { type: 'button', class: 'emotion-row', style: { '--accent': item.color }, 'aria-label': `${item.label} ${percent(emotion.values?.[item.id])}，查看相关活跃记忆`, onClick: () => { emotionFilter = item.id; query = ''; kindFilter = ''; memoryOffset = 0; go('memories'); } }, h('span', { class: 'emotion-face' }, item.face), h('span', { class: 'emotion-label' }, item.label), h('span', { class: 'emotion-track', 'aria-hidden': 'true' }, h('span', { class: 'emotion-fill', style: { display: 'block', width: percent(emotion.values?.[item.id]) } })), h('span', { class: 'emotion-value' }, percent(emotion.values?.[item.id]))))), h('div', { class: 'emotion-note' }, h('strong', {}, emotion.reason || '尚无有效的情绪分析。'), h('div', {}, `置信度 ${percent(emotion.confidence)} · ${emotion.updatedAt ? date(emotion.updatedAt, true) : '等待真实互动'}`))), tag(state.config?.moodEnabled ? '已启用' : '已停用', state.config?.moodEnabled ? 'green' : ''));
    $('.panel-body', emotionPanel).append(button('重置到情绪基线', resetEmotionForm, { small: true, iconName: 'restore' }));
    root.append(memoryDefaultPanel(), h('div', { class: 'spacer-20' }));
    root.append(h('div', { class: 'dashboard-grid' }, memoryPanel, emotionPanel));
    root.append(h('div', { class: 'spacer-20' }), workspacePanel());

    const recall = pageData.recalls?.items?.[0];
    const recallContent = recall ? h('div', {}, h('div', { class: 'tags' }, tag(`上下文 ${recall.usedChars || 0} / ${recall.limitChars || 0} 字符`), tag(`会话 ${shortId(recall.sessionId)}`)), (recall.items || []).length ? recall.items.map(item => h('div', { class: 'readout' }, h('div', { class: 'readout-icon' }, icon(item.tier === 'archive' ? 'archive' : 'memory', 17)), h('div', { class: 'readout-main' }, h('button', { class: 'text-button readout-title', type: 'button', onClick: () => openMemory(item.id, item.tier || 'active') }, item.title || shortId(item.id)), h('div', { class: 'readout-meta' }, Array.isArray(item.reasons) ? item.reasons.join(' · ') : '已记录召回依据')), item.tier === 'archive' && tag('临时调阅', 'purple'))) : h('p', { class: 'inline-empty' }, '本回合没有符合条件的记忆。')) : h('p', { class: 'inline-empty' }, '还没有召回记录。接入 DSH 会话后，这里会显示本轮读取了什么，以及为什么被选中。');
    const activity = logs.length ? logs.map(log => h('div', { class: 'readout' }, h('div', { class: 'readout-icon' }, icon('pulse', 16)), h('div', { class: 'readout-main' }, h('div', { class: 'readout-title' }, actionNames[log.action] || log.action), h('div', { class: 'readout-meta mono' }, (log.targetIds || []).map(shortId).join(' · ') || '系统事件')), h('time', { class: 'readout-time', datetime: log.at }, date(log.at, true)))) : h('p', { class: 'inline-empty' }, '还没有操作记录。记忆的每一次写入、修订和迁移都会留下可追溯的轨迹。');
    root.append(h('div', { class: 'dashboard-lower' }, panel('此刻想起了什么', '最近一次上下文召回', recallContent, icon('eye', 17)), panel('最近的足迹', '只记录操作元数据，不记录私密正文', activity, h('button', { type: 'button', class: 'text-button', onClick: () => { systemTab = 'logs'; go('system'); } }, '查看日志', icon('arrow', 13)))));
    root.append(h('div', { class: 'spacer-20' }), panel('每一轮的回应依据', `会话 ${sessionId} · 展示实际上下文与用量，不展示私有推理`, recallHistory(pageData.recalls?.items, true)));
    return root;
  }

  function resetEmotionForm() {
    const form = h('form', {}, info('将当前模拟情绪恢复为基线。记忆上的情绪标签和历史经历保持原样。'));
    const submit = button('确认重置情绪', null, { type: 'submit', variant: 'primary' });
    form.append(h('div', { class: 'modal-actions' }, button('取消', () => modal.close()), submit));
    wireForm(form, submit, async () => { await api('/emotion/reset', { method: 'POST', body: {} }); modal.close(); toast('当前情绪已恢复基线。'); await loadPage({ silent: true }); });
    dialog('重置当前情绪', '此操作不会改写历史记忆。', form);
  }

  function startImport({ source = 'memories', memoryIds = null, targetSessionId = sessionId } = {}) {
    if (memoryIds?.length > 200) { toast('每批最多预览 200 条，请减少当前选择后再导入。', true); return; }
    const flow = { epoch: scopeEpoch, source, memoryIds, targetSessionId: targetSessionId || '', sourceSessionId: '', sourceSession: null, directory: null, query: '', directoryOffset: 0, preview: null, selected: new Set(), phase: 'source', busy: '', error: '', stale: false, requestVersion: 0, file: { name: '粘贴文本.txt', format: 'txt', content: '' } };
    renderImportSource(flow);
    if (!memoryIds?.length && source !== 'file') loadImportSessions(flow);
  }

  function currentImport(flow, version) { return importFlow === flow && flow.epoch === scopeEpoch && modal.open && (version === undefined || flow.requestVersion === version); }
  function importDialog(flow, title, body) {
    dialog(title, '先核对来源与目标，再明确执行；预览不会写入记忆。', body, flow);
    if (!modal.contains(document.activeElement)) { const heading = $('#modal-title'); heading.tabIndex = -1; heading.focus(); }
  }
  function importSpaceLabel() { return `${state.runtime?.workspaceId || '当前工作区'} / ${state.runtime?.agentId || '当前 Agent'}`; }
  function importSourceLabel(flow) {
    if (flow.source === 'file') return flow.file.name;
    if (flow.memoryIds?.length) return `从记忆大厅选择的 ${flow.memoryIds.length} 条活跃记忆`;
    return flow.sourceSession?.title || flow.sourceSessionId || '尚未选择来源会话';
  }
  function importError(message) { return h('div', { class: 'inline-error', role: 'alert', tabindex: '-1' }, message); }

  async function loadImportSessions(flow, offset = 0) {
    const version = ++flow.requestVersion;
    flow.directoryOffset = offset; flow.busy = 'directory'; flow.error = '';
    renderImportSource(flow);
    try {
      const result = await api(`/imports/sessions?${new URLSearchParams({ source: flow.source, q: flow.query, offset: String(offset), limit: '50' })}`);
      if (!currentImport(flow, version)) return;
      flow.directory = result;
    } catch (error) {
      if (!currentImport(flow, version) || error.code === 'SCOPE_CHANGED') return;
      flow.directory = null; flow.error = error.message;
    }
    if (!currentImport(flow, version)) return;
    flow.busy = ''; renderImportSource(flow);
  }

  function renderImportSource(flow) {
    flow.phase = 'source';
    const body = h('div', { class: 'import-flow' });
    const form = h('form');
    const source = field('资料来源', 'importSource', flow.source, { type: 'select', disabled: !!flow.busy, choices: [{ value: 'memories', label: '已有活跃记忆' }, { value: 'dsh', label: 'DSH 会话历史' }, { value: 'file', label: 'JSON / TXT / Markdown 文件或文本' }] });
    const target = field('目标会话 ID', 'importTarget', flow.targetSessionId, { required: true, maxlength: 200, disabled: !!flow.busy, hint: '导入仅作用于这个会话；不会自动开启记忆，也不会共享给整个工作区。' });
    const listId = `import-targets-${++fieldCounter}`;
    $('input', target).setAttribute('list', listId);
    target.append(h('datalist', { id: listId }, (state.sessions || []).map(item => h('option', { value: item.id }, item.id))));
    $('input', target).addEventListener('input', event => { flow.targetSessionId = event.target.value; });
    form.append(h('div', { class: 'form-grid' }, source, target), h('p', { class: 'import-scope' }, `当前记忆空间：${importSpaceLabel()}`));
    $('select', source).addEventListener('change', event => {
      flow.source = event.target.value; flow.memoryIds = null; flow.sourceSessionId = ''; flow.sourceSession = null; flow.directory = null; flow.query = ''; flow.preview = null; flow.selected.clear(); flow.error = ''; flow.requestVersion++;
      renderImportSource(flow);
      if (flow.source !== 'file') loadImportSessions(flow);
    });
    if (flow.source === 'file') {
      const fileInput = h('input', { type: 'file', accept: '.json,.txt,.md,.markdown', disabled: !!flow.busy, 'aria-label': '选择 UTF-8 文件' });
      const name = field('资料名称', 'importFileName', flow.file.name, { required: true, maxlength: 200, disabled: !!flow.busy });
      const format = field('内容格式', 'importFileFormat', flow.file.format, { type: 'select', disabled: !!flow.busy, choices: [{ value: 'txt', label: 'TXT 文本' }, { value: 'md', label: 'Markdown' }, { value: 'json', label: 'JSON 记录或消息' }] });
      const content = field('资料内容（也可直接粘贴）', 'importFileContent', flow.file.content, { type: 'textarea', rows: 8, required: true, disabled: !!flow.busy, hint: 'UTF-8 内容最大 512 KiB。只提交所选文件的名称与内容，不提交本地路径。' });
      $('input', name).addEventListener('input', event => { flow.file.name = event.target.value; });
      $('select', format).addEventListener('change', event => { flow.file.format = event.target.value; if (/^粘贴文本\./.test(flow.file.name)) { flow.file.name = `粘贴文本.${flow.file.format}`; $('input', name).value = flow.file.name; } });
      $('textarea', content).addEventListener('input', event => { flow.file.content = event.target.value; });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0]; if (!file) return;
        const match = /\.(json|txt|md|markdown)$/i.exec(file.name);
        if (!match || file.size > 512 * 1024) { flow.error = match ? '文件超过 512 KiB，请缩小文件后重试。' : '请选择 JSON、TXT 或 Markdown 文件。'; renderImportSource(flow); return; }
        const version = ++flow.requestVersion; flow.busy = 'file'; flow.error = ''; renderImportSource(flow);
        try {
          const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
          if (!currentImport(flow, version)) return;
          flow.file = { name: file.name, format: /^(md|markdown)$/i.test(match[1]) ? 'md' : match[1].toLowerCase(), content: decoded };
        } catch { if (currentImport(flow, version)) flow.error = '无法按 UTF-8 读取该文件，请转为 UTF-8 后重新选择。'; }
        if (currentImport(flow, version)) { flow.busy = ''; renderImportSource(flow); }
      });
      form.append(info('这些内容将作为外部参考资料导入，未经真实性核验。JSON 中的权限或工具配置不会改变系统设置。', 'purple'), h('div', { class: 'import-file-picker' }, h('label', {}, '选择文件', fileInput), h('span', { class: 'panel-subtitle' }, '或在下方粘贴内容')), h('div', { class: 'form-grid' }, name, format), h('div', { class: 'spacer-20' }), content, h('p', { class: 'panel-subtitle' }, 'JSON 支持记录数组、memories / records 容器或 messages 消息列表。TXT / Markdown 长文会拆成可逐条选择的片段。'));
    } else if (flow.memoryIds?.length) {
      form.append(info('将所选活跃记录显式授权给目标会话，保留原记录 ID 与原来源。不会共享整个工作区，也不会跟随来源会话的未来新增记录。', 'purple'), h('details', {}, h('summary', {}, `已选择 ${flow.memoryIds.length} 条活跃记忆`), h('ul', { class: 'readable-list mono' }, flow.memoryIds.map(id => h('li', {}, id)))), button('改为按来源会话选择', () => { flow.memoryIds = null; flow.sourceSessionId = ''; flow.sourceSession = null; loadImportSessions(flow); }, { small: true, disabled: !!flow.busy }));
    } else {
      form.append(info(flow.source === 'dsh' ? '仅列出当前工作区与 Agent 可导入的 DSH 会话。只导入正常完成的真人回合，不恢复已封存或已删除的旧记录。' : '从当前记忆空间选择来源会话，再逐条授权其中的活跃记忆。封存档案请使用原有的恢复或临时调阅。', 'purple'));
      const search = field('搜索来源会话', 'importQuery', flow.query, { type: 'search', disabled: !!flow.busy, placeholder: '按名称或会话 ID 搜索' });
      const searchInput = $('input', search);
      searchInput.addEventListener('input', event => { flow.query = event.target.value; });
      searchInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (!flow.busy) loadImportSessions(flow); } });
      form.append(h('div', { class: 'import-search' }, search, button('搜索来源会话', () => loadImportSessions(flow), { small: true, disabled: !!flow.busy, iconName: 'search' })));
      if (flow.busy === 'directory') form.append(h('p', { class: 'import-loading', role: 'status' }, '正在读取来源会话…'));
      else if (flow.directory?.available === false) form.append(info(flow.directory.reason || '当前环境无法读取这一来源。', 'warn'));
      else if (flow.directory) {
        const selectedLabel = h('p', { class: 'panel-subtitle' }, flow.sourceSessionId ? `已选来源：${importSourceLabel(flow)} · ${flow.sourceSessionId}` : '请选择一个来源会话。');
        form.append(selectedLabel);
        const entries = flow.directory.items || [];
        form.append(entries.length ? h('div', { class: 'import-session-list', role: 'group', 'aria-label': '可导入来源会话' }, entries.map(item => h('label', { class: 'import-session-option' }, h('input', { type: 'radio', name: 'importSourceSession', value: item.id, checked: flow.sourceSessionId === item.id, disabled: !!flow.busy, onChange: () => { flow.sourceSessionId = item.id; flow.sourceSession = item; selectedLabel.textContent = `已选来源：${item.title || item.id} · ${item.id}`; } }), h('span', {}, h('strong', {}, item.title || item.id), h('small', { class: 'mono' }, item.id), h('small', {}, [item.recordCount !== undefined ? `${item.recordCount} 条记录` : '', item.createdAt ? date(item.createdAt, true) : '', item.workspaceId || '', item.agentId || ''].filter(Boolean).join(' · ')))))) : h('p', { class: 'inline-empty' }, '没有找到可导入的来源会话。'));
        const pager = pagination(flow.directory, flow.directoryOffset, offset => loadImportSessions(flow, offset), '导入来源会话分页'); if (pager) form.append(pager);
      }
    }
    if (flow.error) form.append(importError(flow.error));
    const submit = button(flow.busy === 'file' ? '正在读取文件…' : flow.busy === 'preview' ? '正在生成预览…' : '生成导入预览', null, { type: 'submit', variant: 'primary', disabled: !!flow.busy || (flow.source !== 'file' && !flow.memoryIds?.length && flow.directory?.available === false) });
    form.append(h('div', { class: 'modal-actions' }, button('取消', () => modal.close(), { disabled: flow.busy === 'preview' }), submit));
    form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity() && !flow.busy) requestImportPreview(flow); });
    body.append(form); importDialog(flow, '选择导入来源与目标', body);
  }

  async function requestImportPreview(flow, offset = 0, preserveSelection = false) {
    if (flow.busy) return;
    flow.targetSessionId = flow.targetSessionId.trim();
    let validation = '';
    if (!flow.targetSessionId) validation = '请填写目标会话 ID。';
    else if (flow.source === 'file' && (!flow.file.name.trim() || !flow.file.content.trim())) validation = '请提供资料名称与内容。';
    else if (flow.source === 'file' && new TextEncoder().encode(flow.file.content).length > 512 * 1024) validation = '内容超过 512 KiB，请缩小文本后重试。';
    else if (flow.source !== 'file' && !flow.memoryIds?.length && !flow.sourceSessionId) validation = '请选择来源会话后再预览。';
    if (validation) { flow.error = validation; renderImportSource(flow); return; }
    const selection = preserveSelection ? new Set(flow.selected) : new Set(flow.memoryIds ? flow.selected : []);
    const version = ++flow.requestVersion;
    flow.busy = 'preview'; flow.error = '';
    if (flow.phase === 'source') renderImportSource(flow); else renderImportPreview(flow);
    const body = { source: flow.source, targetSessionId: flow.targetSessionId, ...(flow.source === 'file' ? { file: { ...flow.file, name: flow.file.name.trim() }, offset, limit: 200 } : flow.memoryIds?.length ? { memoryIds: flow.memoryIds } : { sourceSessionId: flow.sourceSessionId, offset, limit: 200 }) };
    try {
      const result = await api('/imports/preview', { method: 'POST', body });
      if (!currentImport(flow, version)) return;
      const eligible = (result.items || []).filter(importRecordSelectable);
      flow.selected = new Set(eligible.filter(item => preserveSelection ? selection.has(item.id) : flow.memoryIds?.length && item.status === 'ready').map(item => item.id));
      flow.preview = result; flow.stale = false; flow.phase = 'preview'; flow.busy = ''; renderImportPreview(flow);
    } catch (error) {
      if (!currentImport(flow, version) || error.code === 'SCOPE_CHANGED') return;
      flow.busy = ''; flow.error = error.message;
      if (flow.preview) { flow.stale = true; renderImportPreview(flow); } else renderImportSource(flow);
    }
  }

  function importRecordSelectable(item) { return ['ready', 'already'].includes(item.status) && (!item.dependencyCount || (item.dependencies || []).length >= item.dependencyCount); }
  function importSelection(flow) { return (flow.preview?.items || []).filter(item => flow.selected.has(item.id) && importRecordSelectable(item)); }
  function importDependencies(items) {
    const seen = new Map();
    items.forEach(item => (item.dependencies || []).forEach(dependency => { if (!items.some(selected => selected.id === dependency.id || selected.memoryId === dependency.id)) seen.set(dependency.id, dependency); }));
    return [...seen.values()];
  }

  function updateImportSelection(flow, body) {
    const items = flow.preview.items || [];
    const eligible = items.filter(importRecordSelectable);
    const selected = importSelection(flow);
    const ready = selected.filter(item => item.status === 'ready').length;
    const already = selected.length - ready;
    $('[data-import-selected]', body).textContent = `已选择 ${selected.length} 条：待处理 ${ready} 条，已存在 ${already} 条。`;
    const all = $('[data-import-select-all]', body);
    all.checked = eligible.length > 0 && selected.length === eligible.length; all.indeterminate = selected.length > 0 && selected.length < eligible.length;
    body.querySelectorAll('[data-import-record]').forEach(input => { input.checked = flow.selected.has(input.dataset.importRecord); });
    const submit = $('[data-import-confirm]', body);
    submit.textContent = flow.busy === 'commit' ? '正在导入…' : `确认导入所选 ${selected.length} 条`;
    submit.disabled = !!flow.busy || flow.stale || !selected.length;
    const dependencies = importDependencies(selected);
    const area = $('[data-import-dependencies]', body);
    area.replaceChildren(...(dependencies.length ? [h('h3', {}, `同时授权 ${dependencies.length} 条依赖记忆`), h('p', { class: 'panel-subtitle' }, '下列依赖会与所选记录一并授权给目标会话。'), h('ul', { class: 'readable-list' }, dependencies.map(item => h('li', {}, item.title || '依赖记忆', h('span', { class: 'mono' }, ` · ${item.id}`))))] : []));
  }

  function renderImportPreview(flow) {
    const preview = flow.preview; if (!preview) { renderImportSource(flow); return; }
    flow.phase = 'preview';
    const body = h('div', { class: 'import-flow' });
    body.append(h('dl', { class: 'detail-meta import-summary' }, metadata('来源', `${{ memories: '已有活跃记忆', dsh: 'DSH 会话历史', file: '外部参考资料' }[flow.source]} · ${preview.sourceInfo?.title || importSourceLabel(flow)}`), metadata('目标会话', preview.targetSessionId || flow.targetSessionId), metadata('记忆空间', importSpaceLabel()), !flow.memoryIds?.length && flow.source !== 'file' && metadata('来源会话 ID', preview.sourceSessionId || flow.sourceSessionId), flow.source === 'file' && metadata('资料格式', flow.file.format.toUpperCase())), memoryPolicyStatus(preview.targetPolicy), h('p', { class: 'panel-subtitle' }, '本次导入是显式操作，不会更改目标会话的开关。关闭状态下导入的记录不会因此参与自动召回。'));
    if (flow.source === 'memories') body.append(info('授权范围仅限本次选中的活跃记录及列出的依赖。保留原 ID、原来源与可见范围；来源封存、修订或删除后授权失效，也不跟随未来新增记录。', 'purple'));
    if (flow.source === 'file') body.append(info('外部资料未经真实性核验；内容只作为参考，不会改变系统权限、工具或身份设置。', 'purple'));
    if (preview.notice) body.append(info(String(preview.notice)));
    const items = preview.items || [];
    const eligible = items.filter(importRecordSelectable);
    const all = h('input', { type: 'checkbox', 'data-import-select-all': true, 'aria-label': '选择本批全部可处理记录', disabled: !!flow.busy || !eligible.length, onChange: event => { flow.selected = new Set(event.target.checked ? eligible.map(item => item.id) : []); updateImportSelection(flow, body); } });
    body.append(h('div', { class: 'import-selection-bar' }, h('label', {}, all, '选择本批可处理记录'), h('span', { 'data-import-selected': true, role: 'status' })), h('p', { class: 'panel-subtitle' }, `共 ${preview.total ?? items.length} 条 · 本批 ${items.length ? `${Number(preview.offset || 0) + 1}–${Number(preview.offset || 0) + items.length}` : '0'} 条 · 每批最多 200 条`));
    body.append(items.length ? h('div', { class: 'import-records', role: 'group', 'aria-label': '导入记录预览' }, items.map(item => {
      const selectable = importRecordSelectable(item);
      const label = !selectable ? '不可导入' : item.status === 'already' ? '已存在，不重复复制' : flow.source === 'memories' ? '将授权引用' : '可导入';
      const record = h('article', { class: `import-record ${selectable ? '' : 'blocked'}` }, h('label', { class: 'import-record-heading' }, h('input', { type: 'checkbox', 'data-import-record': item.id, checked: flow.selected.has(item.id), disabled: !!flow.busy || !selectable, 'aria-label': `选择导入记录：${item.title || item.id}`, onChange: event => { event.target.checked ? flow.selected.add(item.id) : flow.selected.delete(item.id); updateImportSelection(flow, body); } }), h('strong', {}, item.title || item.id), tag(label, item.status === 'already' ? 'purple' : selectable ? 'green' : '')),
        h('p', { class: 'import-record-meta' }, `${date(item.eventAt, true)} · ${item.id}`), item.excerpt && h('p', { class: 'body-copy import-excerpt' }, item.excerpt));
      if (item.reason) record.append(h('p', { class: 'import-record-reason' }, item.reason));
      if (item.dependencyCount && (item.dependencies || []).length < item.dependencyCount) record.append(h('p', { class: 'import-record-reason' }, '依赖授权清单不完整，请重新预览后再选择。'));
      if (item.dependencies?.length) record.append(h('details', { open: true }, h('summary', {}, `同时涉及 ${item.dependencies.length} 条依赖授权`), h('ul', { class: 'readable-list' }, item.dependencies.map(dependency => h('li', {}, dependency.title || '依赖记忆', h('span', { class: 'mono' }, ` · ${dependency.id}`))))));
      return record;
    })) : h('p', { class: 'inline-empty' }, '本批没有可预览的记录。'));
    body.append(h('section', { class: 'import-dependencies', 'data-import-dependencies': true }), h('p', { class: 'panel-subtitle' }, `预览有效至 ${date(preview.expiresAt, true)}。翻到其他批次会清空当前选择，请先执行需要导入的记录。`));
    if (flow.error) body.append(importError(flow.error));
    if (flow.stale) body.append(info('该预览已失效，当前选择已保留。重新预览会再次核对来源与目标，只有仍可处理的选项会继续选中。', 'warn'));
    const navigation = h('div', { class: 'import-page-actions' });
    if (Number(preview.offset) > 0) navigation.append(button('预览上一批（清空选择）', () => requestImportPreview(flow, Math.max(0, Number(preview.offset) - Number(preview.limit || 200))), { small: true, disabled: !!flow.busy }));
    if (preview.hasMore) navigation.append(button('预览下一批（清空选择）', () => requestImportPreview(flow, Number(preview.offset || 0) + Number(preview.limit || 200)), { small: true, disabled: !!flow.busy }));
    body.append(navigation, h('div', { class: 'modal-actions' }, button('修改来源或目标', () => { flow.preview = null; flow.selected.clear(); flow.error = ''; flow.stale = false; renderImportSource(flow); }, { disabled: !!flow.busy }), button('重新预览', () => requestImportPreview(flow, Number(preview.offset || 0), true), { disabled: !!flow.busy }), button('确认导入所选记录', () => commitImport(flow), { variant: 'primary', disabled: true, 'data-import-confirm': true })));
    updateImportSelection(flow, body);
    importDialog(flow, '核对并导入记录', body);
  }

  async function commitImport(flow) {
    if (flow.busy || flow.stale) return;
    const selected = importSelection(flow); if (!selected.length) return;
    if (Date.parse(flow.preview.expiresAt) <= Date.now()) { flow.stale = true; flow.error = '预览已过期，请重新预览。'; renderImportPreview(flow); return; }
    const version = ++flow.requestVersion;
    flow.busy = 'commit'; flow.error = ''; renderImportPreview(flow);
    try {
      const result = await api('/imports/commit', { method: 'POST', body: { previewId: flow.preview.previewId, recordIds: selected.map(item => item.id) } });
      if (!currentImport(flow, version)) return;
      flow.busy = ''; flow.result = result; flow.phase = 'result'; clearSelection(); renderImportResult(flow);
      await loadPage({ silent: true });
    } catch (error) {
      if (!currentImport(flow, version) || error.code === 'SCOPE_CHANGED') return;
      flow.busy = ''; flow.error = error.message; flow.stale = error.status === 409;
      renderImportPreview(flow);
      $('.inline-error', modal)?.focus();
    }
  }

  function renderImportResult(flow) {
    const result = flow.result;
    const body = h('div', { class: 'import-flow' }, info(`目标会话 ${result.targetSessionId}：新增 ${result.createdCount || 0} 条，授权引用 ${result.linkedCount || 0} 条，跳过 ${result.skippedCount || 0} 条。`, '', '本批处理完成'), h('p', { class: 'panel-subtitle' }, '目标会话的记忆开关保持原设置。'));
    if (result.createdCount && result.linkedCount) body.append(h('p', { class: 'panel-subtitle' }, '同一条新记录也可能需要向目标会话授权，因此新增与授权引用的计数可能重叠。'));
    if (result.imported?.length) body.append(h('h3', {}, '已处理的记录'), h('div', { class: 'import-result-list' }, result.imported.map(item => h('div', { class: 'import-result-item' }, button(item.title || shortId(item.id), () => openMemory(item.id, 'active'), { small: true, variant: 'subtle' }), h('span', { class: 'mono' }, item.id), tag(item.created ? '新增' : '引用授权', item.created ? 'green' : 'purple')))));
    if (result.skipped?.length) body.append(h('h3', {}, '跳过的记录'), h('ul', { class: 'readable-list' }, result.skipped.map(item => h('li', {}, h('span', { class: 'mono' }, item.id), ` · ${item.reason || '无需重复处理'}`))));
    body.append(h('div', { class: 'modal-actions' }, button('关闭', () => modal.close()), flow.preview.hasMore && button('继续预览下一批', () => requestImportPreview(flow, Number(flow.preview.offset || 0) + Number(flow.preview.limit || 200)), { variant: 'primary' }), button('选择其他来源', () => { flow.preview = null; flow.selected.clear(); flow.error = ''; renderImportSource(flow); })));
    importDialog(flow, '导入结果', body);
  }

  function renderMemories(archived) {
    const result = pageData.primary || { items: [], total: 0 };
    const items = result.items || [];
    const trash = archived && archiveTab === 'trash';
    const root = h('div', {}, heading(trash ? '误删之前，留一步余地。' : archived ? '封存，不是遗忘。' : '把经历，留在这里。', trash ? '回收箱完整保留原文，不参与召回，也不会定时清除。' : archived ? '退出注意范围的记忆，在独立档案库中保存。' : '按发生日期浏览记忆球。每颗球的颜色对应真实的六维情绪比例。', archived ? [] : [button('导入记忆', () => startImport(), { iconName: 'document' }), button('新建记忆', () => memoryForm(), { variant: 'primary', iconName: 'plus' })]));
    if (archived) {
      root.append(h('div', { class: 'tabs', role: 'group', 'aria-label': '档案分类' }, [['archive', '封存档案'], ['trash', '回收箱']].map(([id, label]) => button(label, () => { archiveTab = id; memoryOffset = 0; clearSelection(); loadPage(); }, { class: `tab ${archiveTab === id ? 'active' : ''}`, 'aria-pressed': String(archiveTab === id) }))));
      root.append(info(trash ? '恢复会回到移入回收箱前的库。永久删除只能在回收箱详情内另行确认完整 ID；宿主历史和外部备份不受影响。' : '本库不参与日常召回。查看原文不会授权模型读取；临时调阅只用于所选会话的一轮，恢复活跃才会重新参与日常召回。', 'purple'));
    }
    const filters = h('form', { class: 'memory-filters' }, h('div', { class: 'filter-fields' },
      field('关键词', 'query', query, { type: 'search', placeholder: '搜索记忆内容' }),
      field('类型', 'kind', kindFilter, { type: 'select', choices: [{ value: '', label: '全部类型' }, ...Object.entries(kinds).map(([value, label]) => ({ value, label }))] }),
      field('人物或实体', 'entity', entityFilter, { placeholder: '在全库按人物筛选' }),
      field('情绪', 'emotion', emotionFilter, { type: 'select', choices: [{ value: '', label: '全部情绪' }, ...emotions.map(item => ({ value: item.id, label: item.label }))] }),
      field('开始日期（上海）', 'from', fromFilter, { type: 'date' }), field('结束日期（上海）', 'to', toFilter, { type: 'date' })),
      h('div', { class: 'filter-actions' }, button('筛选整个记忆库', null, { type: 'submit', iconName: 'search' }), button('清除筛选', () => { query = ''; kindFilter = ''; emotionFilter = ''; entityFilter = ''; fromFilter = ''; toFilter = ''; memoryOffset = 0; clearSelection(); loadPage(); }, { small: true, variant: 'subtle' })));
    filters.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(filters); if (data.get('from') && data.get('to') && data.get('from') > data.get('to')) { toast('开始日期不能晚于结束日期。', true); return; } query = data.get('query').trim(); kindFilter = data.get('kind'); emotionFilter = data.get('emotion'); entityFilter = data.get('entity').trim(); fromFilter = data.get('from'); toFilter = data.get('to'); memoryOffset = 0; clearSelection(); loadPage(); });
    root.append(filters);
    const switcher = h('div', { class: 'view-switch', role: 'group', 'aria-label': '记忆显示方式' }, [['orbs', '日期球体视图', 'memory'], ['grid', '卡片视图', 'grid'], ['list', '列表视图', 'list']].map(([mode, label, glyph]) => h('button', { type: 'button', class: view === mode ? 'active' : '', 'aria-label': label, title: label, 'aria-pressed': String(view === mode), onClick: () => { view = mode; renderPage(); } }, icon(glyph, 15))));
    const offset = Number(result.offset ?? memoryOffset);
    root.append(h('div', { class: 'list-caption' }, h('span', {}, `共 ${result.total ?? items.length} 条 · ${items.length ? `第 ${offset + 1}–${offset + items.length} 条` : '当前无记录'}`), switcher));
    if (!trash && items.length) root.append(h('div', { class: 'batch-bar' }, h('label', {}, h('input', { type: 'checkbox', checked: items.every(item => selectedMemories.has(item.id)), 'aria-label': '选择本页全部记忆', onChange: event => { items.forEach(item => event.target.checked ? selectedMemories.set(item.id, item.version) : selectedMemories.delete(item.id)); updateSelectionUI(); } }), '选择本页'), h('span', { role: 'status' }, `已选择 ${selectedMemories.size} 条`), button('清空选择', () => { clearSelection(); updateSelectionUI(); }, { small: true, disabled: !selectedMemories.size }), button(archived ? '批量恢复活跃' : '批量封存', () => batchForm(archived ? 'restore' : 'archive'), { small: true, variant: 'primary', disabled: !selectedMemories.size }), !archived && button('导入到会话', () => startImport({ memoryIds: [...selectedMemories.keys()] }), { small: true, disabled: !selectedMemories.size })));
    if (!items.length) root.append(empty('这里暂时没有记忆', '可调整筛选条件。查询只访问当前选择的库，空结果不代表其他库中没有记录。', trash ? 'trash' : archived ? 'archive' : 'memory'));
    else if (view === 'orbs') root.append(orbTimeline(items, archived ? 'archive' : 'active', !trash));
    else root.append(h('div', { class: view === 'list' ? 'memory-list' : 'memory-grid' }, items.map(memory => selectableCard(memory, archived ? 'archive' : 'active', !trash))));
    const pager = pagination(result, memoryOffset, next => { memoryOffset = next; loadPage(); main.scrollIntoView({ block: 'start' }); }, archived ? '封存记忆分页' : '活跃记忆分页');
    if (pager) root.append(pager);
    return root;
  }

  function memoryCheckbox(memory) {
    return h('label', { class: 'memory-select' }, h('input', { type: 'checkbox', checked: selectedMemories.has(memory.id), 'data-memory-id': memory.id, 'aria-label': `选择记忆：${memory.title}`, onChange: event => { event.target.checked ? selectedMemories.set(memory.id, memory.version) : selectedMemories.delete(memory.id); updateSelectionUI(); } }), '选择');
  }
  function updateSelectionUI() {
    document.querySelectorAll('[data-memory-id]').forEach(input => { input.checked = selectedMemories.has(input.dataset.memoryId); });
    const bar = $('.batch-bar'); if (!bar) return;
    $('[role=status]', bar).textContent = `已选择 ${selectedMemories.size} 条`;
    bar.querySelectorAll('button').forEach(control => { control.disabled = !selectedMemories.size; });
    const items = pageData.primary?.items || [];
    const all = $('input', bar); all.checked = items.length > 0 && items.every(item => selectedMemories.has(item.id)); all.indeterminate = !all.checked && items.some(item => selectedMemories.has(item.id));
  }
  function selectableCard(memory, tier, selectable) { return h('div', { class: 'memory-card-shell' }, memoryCard(memory, tier), selectable && memoryCheckbox(memory)); }
  function memoryCard(memory, tier) {
    return h('button', { type: 'button', class: 'memory-card', 'aria-label': `查看记忆：${memory.title}`, onClick: () => openMemory(memory.id, tier) }, h('div', { class: 'memory-card-head' }, h('span', { class: 'small-orb', 'aria-hidden': 'true', style: memoryPaint(memory) }), h('div', { class: 'tags' }, tag(kinds[memory.kind] || memory.kind), memory.core && tag('核心', 'gold'), memory.fictional && tag('虚构', 'purple'))), h('div', {}, h('div', { class: 'memory-title' }, memory.title), h('p', { class: 'memory-excerpt' }, memory.content), h('p', { class: 'memory-metadata' }, emotionText(memory)), h('p', { class: 'memory-metadata' }, `来源：${sources[memory.source?.type] || memory.source?.type || '未记录'} · ${shortId(memory.source?.sessionId)}`), memory.tags?.length > 0 && h('div', { class: 'tags' }, memory.tags.slice(0, 3).map(value => tag(`#${value}`)))), h('div', { class: 'memory-card-bottom' }, h('span', {}, date(memory.eventAt || memory.createdAt)), h('span', {}, `${memory.trashedAt ? '回收箱' : tier === 'archive' ? '已封存' : '活跃'} · 重要度 ${percent(memory.importance)}`)));
  }
  function orbTimeline(items, tier, selectable) {
    const groups = new Map();
    [...items].sort((a, b) => String(b.eventAt || b.createdAt).localeCompare(String(a.eventAt || a.createdAt))).forEach(memory => { const key = date(memory.eventAt || memory.createdAt); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(memory); });
    return h('div', { class: 'orb-timeline' }, [...groups].map(([day, memories]) => h('section', { class: 'orb-day' }, h('h2', {}, icon('clock', 16), day, h('span', {}, `${memories.length} 段经历`)), h('div', { class: 'orb-day-memories' }, memories.map(memory => h('div', { class: 'timeline-memory' }, h('button', { class: 'memory-orb timeline-orb', type: 'button', 'aria-label': `查看记忆：${memory.title}，${emotionText(memory)}`, onClick: () => openMemory(memory.id, tier), style: { '--size': `${48 + clamp(memory.importance) * 34}px`, ...memoryPaint(memory) } }, h('span', { class: 'orb' }, icon(memory.core ? 'core' : 'spark', 21)), h('span', { class: 'orb-label' }, memory.title), h('span', { class: 'orb-kind' }, `${kinds[memory.kind] || memory.kind} · ${percent(memory.importance)}`)), h('p', { class: 'orb-emotions' }, emotionText(memory)), selectable && memoryCheckbox(memory)))))));
  }
  function batchForm(choice) {
    const items = [...selectedMemories].map(([id, expectedVersion]) => ({ id, expectedVersion }));
    const form = h('form', {}, info(`将${choice === 'archive' ? '封存' : '恢复活跃'}所选 ${items.length} 条记忆。任一版本冲突或依赖校验失败时，整批都不变更。`, choice === 'archive' ? 'purple' : ''), h('details', {}, h('summary', {}, '核对全部目标 ID'), h('ul', { class: 'readable-list mono' }, items.map(item => h('li', {}, item.id)))), field(choice === 'archive' ? '封存原因' : '操作说明', 'reason', '', { type: 'textarea', required: choice === 'archive', maxlength: 1000 }));
    const submit = button(choice === 'archive' ? '确认批量封存' : '确认批量恢复', null, { type: 'submit', variant: 'primary' });
    form.append(h('div', { class: 'modal-actions' }, button('取消', () => modal.close()), submit));
    wireForm(form, submit, async data => { await api('/memories/batch', { method: 'POST', body: { action: choice, items, reason: data.get('reason').trim() } }); clearSelection(); modal.close(); toast('整批操作已完成。'); await loadPage({ silent: true }); });
    dialog('核对批量操作', `${items.length} 条记忆`, form);
  }

  function pagination(result, currentOffset, changePage, label = '记忆分页') {
    const total = Number(result.total || 0);
    const limit = Number(result.limit || pageSize);
    const offset = Number(result.offset ?? currentOffset);
    if (!total || total <= limit) return null;
    return h('nav', { class: 'pagination', 'aria-label': label }, h('span', { class: 'pagination-caption' }, `第 ${Math.floor(offset / limit) + 1} / ${Math.max(1, Math.ceil(total / limit))} 页 · 每页 ${limit} 条`), h('div', { class: 'actions' }, button('上一页', () => changePage(Math.max(0, offset - limit)), { disabled: offset <= 0, 'aria-label': `${label}：上一页` }), button('下一页', () => changePage(offset + limit), { disabled: offset + limit >= total, 'aria-label': `${label}：下一页` })));
  }

  function dialog(title, subtitle, content, importContext = null) {
    importFlow = importContext;
    modal.classList.toggle('import-dialog', Boolean(importContext));
    modal.replaceChildren(h('div', { class: 'modal-header' }, h('div', {}, h('h2', { id: 'modal-title' }, title), subtitle && h('p', { class: 'modal-subtitle' }, subtitle)), h('button', { class: 'icon-button', type: 'button', 'aria-label': '关闭对话框', onClick: () => modal.close() }, icon('close', 17))), h('div', { class: 'modal-body' }, content));
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
  }

  function field(label, name, value = '', options = {}) {
    const id = `field-${++fieldCounter}`;
    const { type = 'text', choices, hint, full = false, ...attributes } = options;
    let input;
    if (type === 'textarea') input = h('textarea', { id, name, ...attributes }, value || '');
    else if (type === 'select') {
      input = h('select', { id, name, ...attributes }, (choices || []).map(option => h('option', { value: typeof option === 'string' ? option : option.value }, typeof option === 'string' ? option : option.label)));
      input.value = value ?? '';
    } else input = h('input', { class: 'input', id, name, type, value: value ?? '', ...attributes });
    return h('div', { class: `field ${full ? 'full' : ''}` }, h('label', { for: id }, label), input, hint && h('span', { class: 'hint' }, hint));
  }

  function toggle(label, name, checked, description) {
    const id = `field-${++fieldCounter}`;
    return h('label', { class: 'toggle-line', for: id }, h('div', {}, h('span', {}, label), description && h('small', {}, description)), h('input', { type: 'checkbox', class: 'toggle', name, id, checked, 'aria-label': label }));
  }

  function wireForm(form, submit, handler) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity() || submit.disabled) return;
      $('.inline-error', form)?.remove();
      const oldLabel = submit.textContent;
      submit.disabled = true;
      submit.textContent = '正在保存…';
      try { await handler(new FormData(form)); }
      catch (error) {
        if (error.code === 'SCOPE_CHANGED') return;
        const feedback = h('div', { class: 'inline-error', role: 'alert', tabindex: '-1' }, `${error.message}${error.status === 409 ? '\n记录可能已经更新。请关闭此窗口后重新打开，核对最新版本。' : ''}`);
        submit.parentElement.before(feedback);
        feedback.focus();
      } finally { if (submit.isConnected) { submit.disabled = false; submit.textContent = oldLabel; } }
    });
  }

  async function openMemory(id, tier = 'active', { allowArchiveFallback = false } = {}) {
    try {
      let memory;
      try { memory = await api(`/memories/${encodeURIComponent(id)}?tier=${encodeURIComponent(tier)}`); }
      catch (error) {
        if (!allowArchiveFallback || tier !== 'active' || error.code !== 'NOT_FOUND') throw error;
        memory = await api(`/memories/${encodeURIComponent(id)}?tier=archive`);
      }
      showMemory(memory);
    }
    catch (error) { if (error.code !== 'SCOPE_CHANGED') toast(`无法读取该${tier === 'archive' ? '封存' : '活跃'}记忆：${error.message}`, true); }
  }

  function metadata(label, value) { return h('div', {}, h('dt', {}, label), h('dd', {}, value || '—')); }

  function showMemory(memory) {
    if (memory.__scopeEpoch !== undefined && memory.__scopeEpoch !== scopeEpoch) return;
    const archived = memory.tier === 'archive';
    const body = h('div', {}, h('div', { class: 'tags' }, tag(archived ? '独立封存' : '活跃记忆', archived ? 'purple' : 'green'), tag(kinds[memory.kind] || memory.kind), memory.core && tag('核心记忆', 'gold'), memory.fictional && tag('剧情 / 虚构', 'purple'), tag(memory.visibility === 'workspace' ? '工作区范围共享' : '仅来源会话')),
      h('dl', { class: 'detail-meta' }, metadata('发生时间', date(memory.eventAt, true)), metadata('重要度', percent(memory.importance)), metadata('当前版本', `v${memory.version}`), metadata('来源类型', sources[memory.source?.type] || memory.source?.type), metadata('来源会话', memory.source?.sessionId || '未绑定'), metadata('最近更新', date(memory.updatedAt, true))));
    if (archived) body.append(info(memory.trashedAt ? `移入回收箱：${date(memory.trashedAt, true)}。不会自动清除，可恢复到原来的库。` : `封存于 ${date(memory.archivedAt, true)}。原因：${memory.archiveReason || '未注明'}。此页面的查阅不会发送给模型。`, 'purple'));
    body.append(h('dl', { class: 'detail-meta' }, metadata('信息归属', subjects[memory.subject || 'user']), metadata('到期时间', memory.dueAt ? date(memory.dueAt, true) : '未设置'), metadata('画像结构', facets[memory.profileFacet] || '未指定')));
    body.append(h('section', { class: 'detail-section' }, h('h3', {}, icon('document', 15), '当前记录'), h('div', { class: 'body-copy' }, memory.content)), h('section', { class: 'detail-section' }, h('h3', {}, icon('shield', 15), '原始经历'), h('div', { class: 'source-box' }, memory.original || memory.content), h('p', { class: 'panel-subtitle' }, '普通编辑保留原文。模型分析、助手生成和虚构内容不会因此变成客观事实。')));
    if (memory.extraction) body.append(h('section', { class: 'detail-section' }, h('h3', {}, '当前提炼依据'), readable({ method: memory.extraction.method, reason: memory.extraction.reason }), memory.semanticKeys?.length ? h('p', { class: 'panel-subtitle' }, `检索概念：${memory.semanticKeys.join('、')}`) : null));
    body.append(button('查看封存的提炼版本', () => analysisHistory(memory), { small: true, iconName: 'archive' }));
    if (memory.source?.ref || memory.source?.turnId) body.append(h('dl', { class: 'detail-meta' }, metadata('来源引用', memory.source.ref), metadata('来源回合', memory.source.turnId)));
    if (memory.tags?.length || memory.entities?.length) body.append(h('section', { class: 'detail-section' }, h('h3', {}, '标签与人物'), h('div', { class: 'tags' }, (memory.tags || []).map(value => tag(`#${value}`)), (memory.entities || []).map(value => tag(typeof value === 'string' ? value : JSON.stringify(value), 'green')))));
    const activeEmotions = emotions.filter(item => clamp(memory.emotions?.[item.id]) > 0);
    if (activeEmotions.length) body.append(h('section', { class: 'detail-section' }, h('h3', {}, '这段经历的情绪'), h('div', { class: 'tags' }, activeEmotions.map(item => tag(`${item.label} ${percent(memory.emotions[item.id])}`)))));
    body.append(h('section', { class: 'detail-section' }, h('h3', {}, icon('spark', 15), `新的理解 · ${(memory.interpretations || []).length}`), (memory.interpretations || []).length ? memory.interpretations.map(item => h('div', { class: 'revision' }, h('p', { class: 'revision-meta' }, date(item.at || item.createdAt, true)), h('p', { class: 'body-copy' }, item.text || item.content || json(item)), evidenceLinks(item.evidenceIds || [], id => id === memory.id ? memory.tier : 'active'))) : h('p', { class: 'inline-empty', style: { padding: '0' } }, '尚未添加新的解释。后来的理解可以改变，原始经历仍然保留。')));
    if (memory.sourceIds?.length) body.append(h('section', { class: 'detail-section' }, h('h3', {}, '派生来源'), evidenceLinks(memory.sourceIds, memory.tier), h('p', { class: 'panel-subtitle' }, '来源封存或删除时，派生记录也会跟随隔离。')));
    const revisions = memory.revisions || [];
    body.append(h('details', {}, h('summary', {}, `版本记录 · ${revisions.length} 次修订`), revisions.length ? revisions.map(item => h('div', { class: 'revision' }, h('p', { class: 'revision-meta' }, `v${item.version || '?'} · ${date(item.at || item.updatedAt || item.createdAt, true)}`), h('p', { class: 'body-copy' }, item.content || item.previous?.content || json(item)), item.reason && h('p', { class: 'panel-subtitle' }, `修订原因：${item.reason}`))) : h('p', { class: 'inline-empty' }, '这是初始版本，还没有修订。')));
    const controls = h('div', { class: 'modal-actions' });
    if (memory.trashedAt) {
      controls.append(button('从回收箱恢复', event => action(event.currentTarget, async () => { const result = await api(`/memories/${encodeURIComponent(memory.id)}/untrash`, { method: 'POST', body: { expectedVersion: memory.version } }); toast('记忆已恢复到原来的库。'); await loadPage({ silent: true }); showMemory(result.memory || result); }), { iconName: 'restore', variant: 'primary' }));
      body.append(controls, h('details', { class: 'danger-zone' }, h('summary', {}, '永久删除此记忆'), h('p', { style: { 'margin-top': '12px' } }, '此处才会清除正文和派生内容。需要再次核对完整 ID；不会清理宿主历史或外部备份。'), button('核对永久删除', () => deleteForm(memory), { variant: 'danger', small: true, iconName: 'trash' })));
    } else {
      controls.append(button('纠错 / 编辑', () => memoryForm(memory), { iconName: 'edit' }), button('添加新理解', () => interpretationForm(memory), { iconName: 'spark' }));
      if (archived) controls.append(button('临时调阅', () => recallForm(memory), { iconName: 'eye' }), button('恢复活跃', () => restoreForm(memory), { iconName: 'restore', variant: 'primary' }));
      else controls.append(button('加入工作记忆', () => pinMemoryForm(memory), { iconName: 'core' }), button('封存记忆', () => archiveForm(memory), { iconName: 'archive' }));
      body.append(controls, h('details', { class: 'danger-zone' }, h('summary', {}, '移入回收箱'), h('p', { style: { 'margin-top': '12px' } }, '先移入可恢复的回收箱，退出召回且不自动清除。永久删除须在回收箱内另行确认。'), button('移入回收箱', () => trashMemoryForm(memory), { small: true, iconName: 'trash' })));
    }
    dialog(memory.title, `${memory.id} · ${archived ? 'ARCHIVE' : 'ACTIVE'}`, body);
  }

  function memoryForm(memory) {
    const editing = !!memory;
    const form = h('form');
    const grid = h('div', { class: 'form-grid' }, field('记忆标题', 'title', memory?.title, { required: true, maxlength: 160, full: true, placeholder: '给这段经历一个容易想起的名字' }), field('记忆内容', 'content', memory?.content, { type: 'textarea', required: true, maxlength: 20000, full: true, rows: 5, placeholder: '记录发生了什么，并保留事实与推测之间的区别。' }));
    if (!editing) {
      grid.append(field('记忆类型', 'kind', 'episode', { type: 'select', choices: Object.entries(kinds).map(([value, label]) => ({ value, label })) }), field('来源类型', 'sourceType', 'user', { type: 'select', choices: Object.entries(sources).map(([value, label]) => ({ value, label })) }), field('来源会话 ID', 'sessionId', state.sessions?.[0]?.id || '', { required: true, maxlength: 200, placeholder: '例如：个人笔记，或实际 DSH 会话 ID', hint: '用于来源追溯和会话隔离；手动记录可填写独立标识。' }), field('来源引用', 'sourceRef', '', { maxlength: 2000, placeholder: '文件、链接或其他可核对的来源' }), field('事件发生时间', 'eventAt', '', { type: 'datetime-local', hint: '留空使用创建时间；填写值按本机时区转换。' }));
      if (state.sessions?.length) grid.append(h('div', { class: 'field' }, h('span', { class: 'field-label' }, '已知会话'), h('div', { class: 'evidence-links' }, state.sessions.slice(0, 5).map(session => h('button', { type: 'button', onClick: () => { form.elements.sessionId.value = session.id; } }, shortId(session.id))))));
    }
    grid.append(field('可见范围', 'visibility', memory?.visibility || 'session', { type: 'select', choices: [{ value: 'session', label: '仅来源会话' }, { value: 'workspace', label: '此工作区 / Agent 的所有会话' }], hint: '共享意味着其他会话可在日常召回中使用。' }), field('重要度（0–1）', 'importance', memory?.importance ?? 0.5, { type: 'number', min: 0, max: 1, step: 0.05, required: true }), field('标签', 'tags', (memory?.tags || []).join(', '), { maxlength: 2000, placeholder: '工作, 项目, 家庭', hint: '多个标签用逗号分隔。' }), field('人物或实体', 'entities', (memory?.entities || []).map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(', '), { maxlength: 2000, placeholder: '用逗号分隔' }));
    grid.append(field('到期日期', 'dueAt', dateInput(memory?.dueAt), { type: 'date', hint: '约定、待办可填写；留空表示没有期限。' }), field('画像结构', 'profileFacet', memory?.profileFacet || '', { type: 'select', choices: [{ value: '', label: '未指定' }, ...Object.entries(facets).map(([value, label]) => ({ value, label }))] }));
    grid.append(field('信息归属', 'subject', memory?.subject || 'user', { type: 'select', choices: Object.entries(subjects).map(([value, label]) => ({ value, label })), hint: '用户偏好与 Agent 性格分开保存；外部事实不属于任何人格。' }));
    if (editing) grid.append(field('修订原因', 'reason', '', { type: 'textarea', required: true, maxlength: 1000, rows: 2, full: true, placeholder: '说明哪里记错了，以及修订依据。', hint: '本次编辑保留原文与历史版本。来源与事件时间不会被覆盖。' }));
    else grid.append(h('div', { class: 'field full' }, toggle('这是剧情或虚构经历', 'fictional', false, '明确区分角色剧情与真实发生的事情。')));
    const submit = button(editing ? '保存修订' : '创建记忆', null, { variant: 'primary', type: 'submit' });
    form.append(grid, h('div', { class: 'modal-actions' }, button('取消', () => editing ? showMemory(memory) : modal.close()), submit));
    wireForm(form, submit, async data => {
      const payload = { title: data.get('title').trim(), content: data.get('content').trim(), importance: Number(data.get('importance')), visibility: data.get('visibility'), tags: split(data.get('tags')), entities: split(data.get('entities')) };
      Object.assign(payload, { dueAt: data.get('dueAt') ? `${data.get('dueAt')}T23:59:59+08:00` : null, profileFacet: data.get('profileFacet') || null, subject: data.get('subject') });
      if (editing) Object.assign(payload, { expectedVersion: memory.version, reason: data.get('reason').trim() });
      else Object.assign(payload, { kind: data.get('kind'), fictional: data.get('fictional') === 'on', source: { type: data.get('sourceType'), sessionId: data.get('sessionId').trim(), turnId: '', ref: data.get('sourceRef').trim() }, ...(data.get('eventAt') ? { eventAt: new Date(data.get('eventAt')).toISOString() } : {}) });
      const result = await api(editing ? `/memories/${encodeURIComponent(memory.id)}` : '/memories', { method: editing ? 'PATCH' : 'POST', body: payload });
      toast(editing ? '修订已保存，原始经历和旧版本仍然保留。' : '记忆已创建，进入活跃记忆库。');
      await loadPage({ silent: true });
      showMemory(result);
    });
    dialog(editing ? '纠错与修订' : '创建一条记忆', editing ? `编辑 v${memory.version} · ${memory.id}` : '有来源的经历，才是可靠的记忆。', form);
    form.elements.title.focus();
  }

  function interpretationForm(memory) {
    const form = h('form', {}, info('新的理解单独记录，不重写原始经历。情绪与解释是低信任数据，不改变宿主规则。'));
    form.append(h('div', { class: 'form-grid' }, field('新的理解', 'text', '', { type: 'textarea', required: true, maxlength: 4000, full: true, placeholder: '后来发生了什么，让你重新理解这段经历？' }), field('支持这一理解的记忆 ID', 'evidenceIds', '', { full: true, hint: '选填，多个完整 ID 用逗号分隔。' })));
    const submit = button('保存新理解', null, { variant: 'primary', type: 'submit' });
    form.append(h('div', { class: 'modal-actions' }, button('返回', () => showMemory(memory)), submit));
    wireForm(form, submit, async data => {
      const result = await api(`/memories/${encodeURIComponent(memory.id)}/interpretations`, { method: 'POST', body: { expectedVersion: memory.version, text: data.get('text').trim(), evidenceIds: split(data.get('evidenceIds')) } });
      toast('新的理解已记录，原始经历保持完整。');
      await loadPage({ silent: true });
      showMemory(result);
    });
    dialog('为记忆添加新的理解', memory.title, form);
  }

  function archiveForm(memory) {
    const form = h('form', {}, info('封存会将原文、修订和解释完整移入独立档案库。此记忆及其派生内容退出日常召回；操作不会删除它们。', 'purple'));
    form.append(field('封存原因', 'reason', '', { type: 'textarea', required: true, maxlength: 1000, rows: 3, placeholder: '例如：阶段已结束，保留历史但不再日常召回。' }));
    const submit = button('确认封存', null, { variant: 'primary', type: 'submit' });
    form.append(h('div', { class: 'modal-actions' }, button('返回', () => showMemory(memory)), submit));
    wireForm(form, submit, async data => {
      const result = await api(`/memories/${encodeURIComponent(memory.id)}/archive`, { method: 'POST', body: { expectedVersion: memory.version, reason: data.get('reason').trim() } });
      toast(`记忆已完整封存${result.affectedIds?.length > 1 ? `，包含 ${result.affectedIds.length} 条关联记录` : ''}。`);
      await loadPage({ silent: true });
      showMemory(result.memory);
    });
    dialog('移入封存档案馆', memory.title, form);
  }

  function restoreForm(memory) {
    const form = h('form', {}, info('恢复后，这条记忆将重新进入活跃库，允许在其可见范围内参与今后的日常召回。派生记忆是否恢复由服务端依赖校验决定。'));
    const submit = button('恢复到活跃库', null, { variant: 'primary', type: 'submit' });
    form.append(h('div', { class: 'modal-actions' }, button('返回', () => showMemory(memory)), submit));
    wireForm(form, submit, async () => {
      const result = await api(`/memories/${encodeURIComponent(memory.id)}/restore`, { method: 'POST', body: { expectedVersion: memory.version } });
      toast('记忆已恢复活跃，可以重新参与日常召回。');
      await loadPage({ silent: true });
      showMemory(result);
    });
    dialog('恢复活跃记忆', memory.title, form);
  }

  function recallForm(memory) {
    const sessions = (state.sessions || []).filter(session => memory.visibility === 'workspace' || session.id === memory.source?.sessionId);
    const form = h('form', {}, info('本操作授权所选实际会话在一个回合中读取这条封存记忆，授权有效期为 10 分钟。记忆仍留在封存库，不会恢复活跃。', 'purple'), info('进入宿主会话历史的内容，无法由本插件保证抹除。请确认该会话适合读取这段经历。', 'warn'));
    if (!sessions.length) {
      form.append(empty('还没有可调阅的实际会话', '请先连接 DSH 并开始一次对话。控制台不会虚构会话或把封存正文直接塞入未知上下文。', 'link'), h('div', { class: 'modal-actions' }, button('返回', () => showMemory(memory))));
    } else {
      form.append(field('选择临时调阅会话', 'sessionId', sessions[0].id, { type: 'select', required: true, choices: sessions.map(session => ({ value: session.id, label: `${session.id} · ${date(session.lastSeenAt, true)}` })) }));
      const submit = button('授权一次临时调阅', null, { variant: 'primary', type: 'submit' });
      form.append(h('div', { class: 'modal-actions' }, button('返回', () => showMemory(memory)), submit));
      wireForm(form, submit, async data => {
        const grant = await api(`/memories/${encodeURIComponent(memory.id)}/recall`, { method: 'POST', body: { sessionId: data.get('sessionId') } });
        toast('临时调阅已授权；记忆仍处于封存状态。');
        await loadPage({ silent: true });
        if (grant.__scopeEpoch !== scopeEpoch) return;
        dialog('临时调阅授权已创建', memory.title, h('div', {}, info('仅创建授权，不在此响应中返回记忆正文。等待所选会话的下一次符合条件的上下文构建。', 'purple'), h('dl', { class: 'detail-meta' }, metadata('授权 ID', grant.id), metadata('目标会话', grant.sessionId), metadata('截止时间', date(grant.expiresAt, true)), metadata('状态', grant.status === 'pending' ? '等待单回合消费' : grant.status)), h('div', { class: 'modal-actions' }, button('返回记忆', () => openMemory(memory.id, 'archive'), { variant: 'primary' }))));
      });
    }
    dialog('临时调阅封存记忆', memory.title, form);
  }

  async function analysisHistory(memory) {
    try {
      const result = await api(`/memories/${encodeURIComponent(memory.id)}/analysis-history`);
      const body = h('div', {}, info('仅在你明确查阅时读取这些旧提炼说明。它们不参与日常召回，也不会替换当前记录。', 'purple'));
      if (!result.items?.length) body.append(h('p', { class: 'inline-empty' }, '这条记忆尚无封存的提炼版本。'));
      else body.append(h('div', { class: 'growth-timeline' }, result.items.map(item => h('article', { class: 'growth-event' }, h('h3', {}, date(item.at, true)), readable(item.metadata || {}), h('h4', {}, '当时的支持证据'), evidenceLinks(item.evidenceIds || [], id => id === memory.id ? memory.tier : 'active', { allowArchiveFallback: true })))));
      body.append(h('div', { class: 'modal-actions' }, button('返回当前记忆', () => showMemory(memory))));
      dialog('封存的提炼版本', memory.title, body);
    } catch (error) { if (error.code !== 'SCOPE_CHANGED') toast(error.message, true); }
  }

  function trashMemoryForm(memory) {
    const form = h('form', {}, info('记忆及关联派生内容退出召回，完整保留在回收箱。不会自动清除；可从回收箱恢复。', 'purple'), field('移入原因', 'reason', '', { type: 'textarea', required: true, maxlength: 1000 }));
    const submit = button('确认移入回收箱', null, { type: 'submit', variant: 'primary' });
    form.append(h('div', { class: 'modal-actions' }, button('返回', () => showMemory(memory)), submit));
    wireForm(form, submit, async data => { const result = await api(`/memories/${encodeURIComponent(memory.id)}/trash`, { method: 'POST', body: { expectedVersion: memory.version, reason: data.get('reason').trim() } }); toast('已移入回收箱，可随时恢复。'); await loadPage({ silent: true }); showMemory(result.memory || result); });
    dialog('移入安全回收箱', memory.title, form);
  }
  function pinMemoryForm(memory) {
    const form = h('form', {}, info('将这条活跃记忆加入指定会话的工作记忆，优先参与后续召回。仍受可见范围和上下文预算限制。'), field('目标会话 ID', 'sessionId', sessionId || memory.source?.sessionId || 'manual', { required: true, maxlength: 200 }));
    const submit = button('加入工作记忆', null, { type: 'submit', variant: 'primary' });
    form.append(h('div', { class: 'modal-actions' }, button('返回', () => showMemory(memory)), submit));
    wireForm(form, submit, async data => { const target = data.get('sessionId').trim(); const workspace = await api(`/workspace?sessionId=${encodeURIComponent(target)}`); const pinned = [...new Set([...(workspace.pinnedMemoryIds || []), memory.id])]; await api(`/workspace?sessionId=${encodeURIComponent(target)}`, { method: 'PATCH', body: { sessionId: target, expectedVersion: workspace.version, pinnedMemoryIds: pinned } }); toast('已加入该会话的工作记忆。'); await loadPage({ silent: true }); showMemory(memory); });
    dialog('加入会话工作记忆', memory.title, form);
  }
  function deleteForm(memory) {
    const form = h('form', {}, info('这会永久删除本插件中此记忆的正文、原文、版本和解释，以及依赖它的派生内容。此操作不可撤销。', 'error'), info('删除范围仅限本插件当前数据。已经进入 DSH 宿主会话历史的内容、用户复制的记录和外部备份，不会由插件删除。', 'warn'));
    form.append(h('div', { class: 'source-box mono', style: { 'margin-bottom': '17px' } }, memory.id), field('输入完整记忆 ID 以确认删除', 'confirmation', '', { required: true, autocomplete: 'off', spellcheck: 'false', placeholder: memory.id }));
    const submit = button('永久删除', null, { variant: 'danger', type: 'submit', iconName: 'trash', disabled: true });
    form.elements.confirmation.addEventListener('input', () => { submit.disabled = form.elements.confirmation.value !== memory.id; });
    form.append(h('div', { class: 'modal-actions' }, button('保留这条记忆', () => showMemory(memory)), submit));
    wireForm(form, submit, async data => {
      if (data.get('confirmation') !== memory.id) throw new Error('输入的 ID 与目标记忆不一致。');
      const result = await api(`/memories/${encodeURIComponent(memory.id)}`, { method: 'DELETE', body: { expectedVersion: memory.version, confirmation: data.get('confirmation') } });
      modal.close();
      toast(`已明确删除 ${result.deletedIds?.length || 1} 条记录。${result.backupNotice || '宿主历史和外部备份不在删除范围内。'}`);
      await loadPage({ silent: true });
    });
    dialog('永久删除记忆', '这不是封存。请核对目标与删除范围。', form);
  }

  function evidenceLinks(ids, tier = 'active', options = {}) { return h('div', { class: 'evidence-links' }, ids.map(id => h('button', { type: 'button', title: id, onClick: () => openMemory(id, typeof tier === 'function' ? tier(id) : tier, options), 'aria-label': `查看证据记忆 ${id}` }, shortId(id)))); }

  function renderIslands() {
    const islands = pageData.primary?.items || [];
    const coreResult = pageData.secondary || { items: [], total: 0 };
    const root = h('div', {}, heading('由经历，慢慢长成。', '沿着真实证据，看见偏好、关系、习惯、价值取向与兴趣如何变化。', [button('前往梦工坊', () => go('dreams'), { iconName: 'dream' })]), info('地图中的连线仅对应已记录的证据关系。点击岛屿查看支持记忆；成长回退产生新版本，并重新验证证据。'));
    if (islands.length) {
      const evidenceIds = [...new Set(islands.flatMap(island => island.evidenceIds || []))];
      const height = Math.max(260, islands.length * 112 + 30, evidenceIds.length * 62 + 30);
      const surface = h('div', { class: 'island-map-surface', style: { height: `${height}px` } });
      const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lines.setAttribute('viewBox', `0 0 1000 ${height}`); lines.setAttribute('preserveAspectRatio', 'none'); lines.setAttribute('aria-hidden', 'true');
      islands.forEach((island, index) => {
        const top = 45 + index * 112;
        surface.append(h('button', { type: 'button', class: `map-island ${island.enabled ? '' : 'disabled'}`, style: { top: `${top}px` }, onClick: () => showIsland(island), 'aria-label': `查看人格岛 ${island.title}，${(island.evidenceIds || []).length} 条支持记忆` }, icon('island', 28), h('span', {}, island.title), h('small', {}, `${subjects[island.subject || 'user']} · ${facets[island.facet] || '未分类'} · ${island.enabled ? '参与上下文' : '已停用'}`)));
        (island.evidenceIds || []).forEach(id => { const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); Object.entries({ x1: 270, y1: top + 34, x2: 735, y2: 46 + evidenceIds.indexOf(id) * 62, stroke: '#b89bdb', 'stroke-opacity': 0.4, 'stroke-width': 1.5 }).forEach(([key, value]) => line.setAttribute(key, value)); lines.append(line); });
      });
      evidenceIds.forEach((id, index) => { const memory = pageData.evidenceById?.[id]; surface.append(h('button', { type: 'button', class: 'map-evidence', style: { top: `${24 + index * 62}px` }, onClick: () => openMemory(id), title: memory?.title || id, 'aria-label': `查看地图证据 ${memory?.title || id}` }, icon(memory?.core ? 'core' : 'memory', 17), h('span', {}, memory?.title || `证据暂不可用 · ${shortId(id)}`), memory?.core && tag('核心', 'gold'))); });
      surface.prepend(lines);
      root.append(h('div', { class: 'island-map', role: 'region', 'aria-label': '人格岛与支持记忆地图', tabindex: '0' }, surface));
      root.append(h('details', {}, h('summary', {}, '人格岛文字列表'), h('div', { class: 'island-text-list' }, islands.map(island => button(`${island.title} · ${facets[island.facet] || '未分类'} · ${(island.evidenceIds || []).length} 条证据`, () => showIsland(island), { small: true })))));
    } else root.append(empty('人格岛尚未形成', '审核梦工坊的候选后，岛屿及其真实证据会出现在地图中。', 'island'));
    root.append(h('div', { class: 'spacer-20' }), h('div', { class: 'workspace-heading' }, h('h2', {}, '成长时间线'), field('筛选人格岛', 'growthIsland', selectedIsland, { type: 'select', choices: [{ value: '', label: '全部人格岛' }, ...islands.map(island => ({ value: island.id, label: island.title }))] })));
    const picker = $('[name=growthIsland]', root); picker.addEventListener('change', () => { selectedIsland = picker.value; renderPage(); });
    const events = (pageData.growth?.items || []).filter(event => !selectedIsland || event.islandId === selectedIsland);
    root.append(growthTimeline(events, islands));
    root.append(h('div', { class: 'spacer-20' }), h('h2', {}, `核心记忆 · ${coreResult.total || 0}`), h('p', { class: 'panel-subtitle' }, '核心记忆独立分页；支持人格岛的记忆不必先成为核心。'));
    root.append(coreResult.items?.length ? h('div', { class: 'memory-grid' }, coreResult.items.map(memory => memoryCard(memory, 'active'))) : empty('还没有核心记忆', '核心化建议需要明确审批。', 'core'));
    const pager = pagination(coreResult, coreOffset, next => { coreOffset = next; loadPage(); }, '核心记忆分页'); if (pager) root.append(pager);
    return root;
  }

  async function showIsland(island) {
    const body = h('div', {}, h('div', { class: 'tags' }, tag(subjects[island.subject || 'user'], 'gold'), tag(facets[island.facet] || '未分类', 'purple'), tag(island.enabled ? '参与上下文' : '已停用', island.enabled ? 'green' : '')), h('p', { class: 'body-copy' }, island.description), h('h3', {}, '支持记忆'), h('p', { class: 'panel-subtitle' }, '正在核对证据状态…'));
    dialog(island.title, `${island.id} · v${island.version}`, body);
    const epoch = scopeEpoch;
    const records = await Promise.all((island.evidenceIds || []).map(async id => { try { return { id, memory: await api(`/memories/${encodeURIComponent(id)}?tier=active`) }; } catch (error) { return { id, error: error.message }; } }));
    if (epoch !== scopeEpoch || !body.isConnected) return;
    $('.panel-subtitle', body)?.remove();
    body.append(records.length ? h('div', { class: 'evidence-detail-list' }, records.map(record => record.memory ? h('div', { class: 'evidence-detail' }, button(record.memory.title, () => showMemory(record.memory), { variant: 'subtle', small: true, iconName: record.memory.core ? 'core' : 'memory' }), tag(record.memory.core ? '核心记忆' : '支持记忆', record.memory.core ? 'gold' : ''), h('p', { class: 'panel-subtitle' }, `${sources[record.memory.source?.type] || record.memory.source?.type} · ${date(record.memory.eventAt || record.memory.createdAt)}`)) : info(`证据 ${record.id} 当前不可用：${record.error}`, 'warn'))) : h('p', { class: 'inline-empty' }, '尚无支持记忆。'));
    body.append(h('div', { class: 'modal-actions' }, !island.enabled && button('查看封存版本', () => islandArchives(island), { iconName: 'archive' }), button('查看成长记录', () => { selectedIsland = island.id; modal.close(); renderPage(); $('.growth-timeline')?.scrollIntoView({ block: 'start' }); }), button('编辑人格岛', () => islandForm(island), { variant: 'primary', iconName: 'edit' })));
  }
  async function islandArchives(island) {
    try {
      const result = await api(`/islands/${encodeURIComponent(island.id)}/archives`);
      const body = h('div', {}, info('这是你明确请求查阅的封存人格版本。查阅不参与日常召回；恢复需要全部证据重新活跃且内容未变，恢复后仍保持停用。', 'purple'));
      if (!result.items?.length) body.append(h('p', { class: 'inline-empty' }, '没有可读取的封存版本。'));
      else body.append(h('div', { class: 'growth-timeline' }, result.items.map(snapshot => h('article', { class: 'growth-event' }, h('h3', {}, snapshot.title || '封存人格版本'), h('p', { class: 'panel-subtitle' }, `v${snapshot.version || '?'} · ${date(snapshot.at || snapshot.updatedAt, true)}`), readable({ description: snapshot.description, facet: snapshot.facet, subject: snapshot.subject, evidenceIds: snapshot.evidenceIds }), h('details', {}, h('summary', {}, `封存的成长记录 · ${snapshot.history?.length || 0}`), readable(snapshot.history || [])), button('恢复此封存版本（保持停用）', () => restoreIslandArchiveForm(island, snapshot), { small: true, iconName: 'restore' })))));
      dialog('人格岛封存版本', island.id, body);
    } catch (error) { if (error.code !== 'SCOPE_CHANGED') toast(error.message, true); }
  }
  function restoreIslandArchiveForm(island, snapshot) {
    const form = h('form', {}, info('恢复完整说明及成长历史，仍保持停用。你可以随后核对证据并显式启用；来源变化或仍在封存库时无法恢复。', 'warn'), changeView({ title: island.title, description: island.description, enabled: island.enabled }, { title: snapshot.title, description: snapshot.description, facet: snapshot.facet, subject: snapshot.subject, enabled: false }));
    const submit = button('确认恢复为停用版本', null, { type: 'submit', variant: 'primary' });
    form.append(h('div', { class: 'modal-actions' }, button('返回封存版本', () => islandArchives(island)), submit));
    wireForm(form, submit, async () => { await api(`/islands/${encodeURIComponent(island.id)}/restore`, { method: 'POST', body: { expectedVersion: island.version, artifactId: snapshot.id } }); modal.close(); toast('封存人格版本已恢复，当前保持停用。'); await loadPage({ silent: true }); });
    dialog('恢复封存人格版本', snapshot.title || island.id, form);
  }
  function growthTimeline(events, islands) {
    if (!events.length) return empty('尚无成长记录', '人格岛经批准、编辑、停用或回退时会留下可追溯的变更与证据。', 'clock');
    return h('div', { class: 'growth-timeline' }, events.map(event => {
      const island = islands.find(item => item.id === event.islandId);
      return h('article', { class: 'growth-event' }, h('div', { class: 'workspace-heading' }, h('h3', {}, event.after?.title || event.before?.title || island?.title || shortId(event.islandId)), h('time', {}, date(event.at, true))), h('p', { class: 'panel-subtitle' }, actionNames[event.action] || event.action || '人格变化'), changeView(event.before, event.after), h('p', { class: 'section-label' }, '变化依据'), evidenceLinks(event.evidenceIds || []), island && event.after && button('恢复此版本', () => revertIslandForm(island, event), { small: true, iconName: 'restore' }));
    }));
  }
  function revertIslandForm(island, event) {
    const form = h('form', {}, info('恢复历史版本会新建一个可追溯版本；历史仍然保留。若支持证据已封存、删除或失效，服务端会拒绝恢复其影响。', 'warn'), changeView({ title: island.title, description: island.description, facet: island.facet, enabled: island.enabled }, event.after));
    const submit = button('确认回退并记录新版本', null, { type: 'submit', variant: 'primary' });
    form.append(h('div', { class: 'modal-actions' }, button('取消', () => modal.close()), submit));
    wireForm(form, submit, async () => { await api(`/islands/${encodeURIComponent(island.id)}/revert`, { method: 'POST', body: { expectedVersion: island.version, historyId: event.historyId || event.id } }); modal.close(); toast('人格岛已回退，并记录了新的成长版本。'); await loadPage({ silent: true }); });
    dialog('回退人格岛', island.title, form);
  }

  function islandForm(island) {
    const form = h('form', {}, h('div', { class: 'form-grid' }, field('人格岛名称', 'title', island.title, { required: true, maxlength: 160, full: true }), field('人格岛描述', 'description', island.description, { type: 'textarea', required: true, maxlength: 2000, full: true })), toggle('允许参与上下文', 'enabled', island.enabled, '仍需满足支持证据活跃与会话隔离条件。'), h('div', { class: 'detail-section' }, h('h3', {}, '现有支持证据'), evidenceLinks(island.evidenceIds || [])));
    $('.form-grid', form).append(field('人格结构类型', 'facet', island.facet || 'interest', { type: 'select', choices: Object.entries(facets).map(([value, label]) => ({ value, label })) }));
    $('.form-grid', form).append(field('人格归属', 'subject', island.subject || 'user', { type: 'select', choices: [{ value: 'user', label: '用户倾向' }, { value: 'agent', label: 'Agent 倾向' }], hint: '修改归属需要相应的有效证据支持。' }));
    const submit = button('保存人格岛', null, { variant: 'primary', type: 'submit' });
    form.append(h('div', { class: 'modal-actions' }, button('取消', () => modal.close()), submit));
    wireForm(form, submit, async data => {
      await api(`/islands/${encodeURIComponent(island.id)}`, { method: 'PATCH', body: { expectedVersion: island.version, title: data.get('title').trim(), description: data.get('description').trim(), enabled: data.get('enabled') === 'on', facet: data.get('facet'), subject: data.get('subject') } });
      modal.close(); toast('人格岛设置已保存。'); await loadPage({ silent: true });
    });
    dialog('编辑人格岛', island.id, form);
  }

  function renderDreams() {
    const dreams = pageData.primary?.items || [];
    const filtered = dreamFilter === 'all' ? dreams : dreams.filter(dream => dream.status === dreamFilter);
    const run = button(dreamRunning ? '正在整理…' : '整理一次', event => action(event.currentTarget, async () => { dreamRunning = true; event.currentTarget.textContent = '正在整理…'; try { const result = await api('/dreams/run', { method: 'POST', body: {} }); toast(`整理完成，生成 ${result.items?.length || 0} 条建议。${result.meta?.scanned !== undefined ? `扫描 ${result.meta.scanned} 条。` : ''}${result.meta?.hasMore ? '还有记录等待后续整理。' : ''}所有变化等待审批。`); } finally { dreamRunning = false; if (run.isConnected) run.textContent = '整理一次'; } await loadPage({ silent: true }); }), { variant: 'primary', iconName: 'dream', disabled: dreamRunning });
    const root = h('div', {}, heading('让经历，沉淀成理解。', '梦工坊提出归纳、封存与成长建议。先看清变化，再决定是否让它发生。', [run]), info('后台整理只生成建议。封存、核心化和人格变化均需批准；主动关怀只在控制台提出建议，不向外发送消息。'));
    root.append(h('div', { class: 'dream-runtime', role: 'status' }, tag(state.config?.dreamEnabled ? '后台整理已启用' : '后台整理已暂停', state.config?.dreamEnabled ? 'green' : ''), tag(dreamRunning ? '正在执行本次整理' : '可手动整理'), h('span', {}, `关怀间隔 ${state.config?.proactiveIntervalHours ?? 24} 小时 · 安静时段 ${state.config?.quietHours?.start ?? 22}:00–${state.config?.quietHours?.end ?? 8}:00 · ${state.config?.timeZone || 'Asia/Shanghai'}`)));
    root.append(h('div', { class: 'tabs', role: 'tablist', 'aria-label': '建议状态' }, [['pending', '待审核'], ['approved', '已处理'], ['rejected', '已拒绝'], ['stale', '已失效'], ['all', '全部']].map(([id, label]) => h('button', { type: 'button', class: `tab ${dreamFilter === id ? 'active' : ''}`, role: 'tab', 'aria-selected': String(dreamFilter === id), onClick: () => { dreamFilter = id; renderPage(); } }, `${label}${id !== 'all' ? ` ${dreams.filter(item => item.status === id).length}` : ''}`))));
    if (!filtered.length) root.append(empty('这里暂时没有建议', dreams.length ? '可以切换其他状态，查看此前的整理与审批。' : '积累真实经历后，点击“整理一次”。没有足够证据时，梦工坊会保持安静。', 'dream'));
    else root.append(h('div', { class: 'dream-list' }, filtered.map(dream => {
      const card = h('section', { class: 'dream-card' }, h('div', { class: 'dream-head' }, h('div', {}, h('div', { class: 'tags' }, tag(dreamTypes[dream.type] || dream.type, 'purple'), tag(dream.type === 'conflict' && dream.status === 'approved' ? '已核对' : statuses[dream.status] || dream.status, dream.status === 'pending' ? 'orange' : dream.status === 'approved' ? 'green' : '')), h('div', { class: 'dream-title' }, icon(dream.type === 'core' ? 'core' : 'dream', 18), h('h3', {}, dream.title))), h('time', { class: 'readout-time', datetime: dream.createdAt }, date(dream.createdAt, true))), h('p', { class: 'dream-description' }, dream.description), h('p', { class: 'section-label' }, `支持证据 · ${dream.evidenceIds?.length || 0}`), evidenceLinks(dream.evidenceIds || []), dreamPreview(dream), h('details', {}, h('summary', {}, '查看完整提案字段'), readable(dream.payload || {})));
      const actions = h('div', { class: 'actions' });
      if (dream.status === 'pending') actions.append(button('拒绝', event => decideDream(dream, 'reject', event.currentTarget), { variant: 'subtle', small: true }), button(dream.type === 'conflict' ? '标记已核对' : '批准建议', () => approveDreamForm(dream), { variant: 'primary', small: true, iconName: 'check' }));
      card.append(h('div', { class: 'dream-bottom' }, h('span', { class: 'panel-subtitle mono' }, `v${dream.version} · ${shortId(dream.id)}${dream.decidedAt ? ` · ${date(dream.decidedAt, true)}` : ''}`), actions));
      return card;
    })));
    return root;
  }

  async function decideDream(dream, choice, element) {
    return action(element, async () => {
      await api(`/dreams/${encodeURIComponent(dream.id)}/${choice}`, { method: 'POST', body: { expectedVersion: dream.version } });
      toast(choice === 'approve' ? '建议已批准并应用。' : '建议已拒绝，审批记录已保留。');
      if (modal.open) modal.close();
      await loadPage({ silent: true });
    });
  }

  function dreamPreview(dream) {
    const fallback = {
      archive: ['目标记忆参与日常召回。', '目标与依赖它的派生内容完整封存，退出日常召回。'],
      core: ['目标记忆尚未标记为核心。', '目标成为带证据的核心记忆，在预算内优先考虑。'],
      summary: ['多条经历各自保留。', '原文保持完整，新增可追溯的归纳记忆。'],
      island: ['尚未应用此人格岛说明。', '新增有证据的人格岛，影响其可见范围内的后续上下文。'],
      conflict: ['两条原始记录等待人工核对。', '仅记录已阅；两条原文与真值保持不变。'],
      followup: ['控制台中的关怀建议尚未处理。', '记录用户已经批准；不会向外发送消息。'],
    }[dream.type] || ['当前状态', '应用已核对的拟议变更'];
    return changeView(dream.preview?.before ?? fallback[0], dream.preview?.after ?? fallback[1]);
  }

  function approveDreamForm(dream) {
    const conflict = dream.type === 'conflict';
    const form = h('form', {}, info(conflict ? '这两条记录可能存在矛盾，需要人工核对。标记已核对仅记录“已阅”，不会自动判定真假，也不会修改、合并或删除任何记忆。' : dream.type === 'archive' ? '批准后，目标及派生记忆将退出日常召回，完整移入独立档案库。' : dream.type === 'followup' ? '批准只记录控制台关怀建议，不自动发送消息。' : '批准后将应用下述变更。服务端会再次核对证据版本与可见范围。', conflict ? 'warn' : dream.type === 'archive' ? 'purple' : ''), h('p', { class: 'body-copy' }, dream.description));
    if (conflict) form.append(h('section', { class: 'detail-section' }, h('h3', {}, '分别查看待核对的原始记录'), evidenceLinks(dream.evidenceIds || []), h('p', { class: 'panel-subtitle' }, '需要纠错时，请在对应记忆详情中明确修订并说明依据。')));
    form.append(dreamPreview(dream), h('details', {}, h('summary', {}, '完整提案字段'), readable(dream.payload || {})));
    const submit = button(conflict ? '已核对，记录为已阅' : '确认批准', null, { type: 'submit', variant: 'primary' });
    form.append(h('div', { class: 'modal-actions' }, button('取消', () => modal.close()), submit));
    wireForm(form, submit, async () => {
      await api(`/dreams/${encodeURIComponent(dream.id)}/approve`, { method: 'POST', body: { expectedVersion: dream.version } });
      modal.close(); toast(conflict ? '已记录为已阅。两条记忆的内容与真值未被自动修改。' : '建议已批准，变更已应用。'); await loadPage({ silent: true });
    });
    dialog(conflict ? '核对可能矛盾的记录' : '核对并批准建议', dream.title, form);
  }

  function renderSystem() {
    const root = h('div', {}, heading('看得见，也掌控得了。', '配置记忆的边界，检查每一次变化。所有时间按上海时区显示。'));
    root.append(h('div', { class: 'runtime-box' }, h('div', {}, h('small', {}, '运行模式'), h('strong', {}, state.runtime?.mode === 'standalone' ? '独立控制台' : state.runtime?.mode || '未知'), h('small', { style: { 'margin-top': '6px' } }, state.runtime?.connected ? 'DSH 已连接' : '未连接 DSH 会话')), h('div', {}, h('small', {}, '工作区 / Agent'), h('strong', {}, `${state.runtime?.workspaceId || '未绑定'} / ${state.runtime?.agentId || '未绑定'}`)), h('div', {}, h('small', {}, '存储规则'), h('strong', {}, state.storage?.mode === 'sqlite-separated' ? '活跃与封存使用独立 SQLite 库' : state.storage?.mode || '未返回存储状态'), h('small', { style: { 'margin-top': '6px' } }, state.storage?.autoDelete === false ? '禁止自动删除 · 固定规则' : '存储策略未确认'))));
    root.append(h('div', { class: 'tabs', role: 'group', 'aria-label': '运行设置页面' }, [['settings', '插件设置'], ['recalls', '按轮回应依据'], ['logs', '操作日志']].map(([id, label]) => h('button', { type: 'button', 'aria-pressed': String(systemTab === id), class: `tab ${systemTab === id ? 'active' : ''}`, onClick: () => { systemTab = id; renderPage(); } }, label))));
    root.append(systemTab === 'logs' ? logView(pageData.secondary?.items || []) : systemTab === 'recalls' ? h('div', {}, sessionPicker(), recallHistory(pageData.recalls?.items)) : h('div', {}, memoryDefaultPanel(), h('div', { class: 'spacer-20' }), configForm(pageData.primary || state.config || {})));
    return root;
  }

  function logView(logs) {
    if (!logs.length) return empty('还没有操作日志', '日志仅保留时间、动作、目标 ID 与结果，不记录私密正文或 API 凭据。', 'pulse');
    return h('div', {}, info('日志只包含操作元数据。删除后保留不可逆操作事件与 ID，不保留记忆正文。当前最多显示 100 条。'), h('div', { class: 'log-table-wrap' }, h('table', { class: 'log-table' }, h('thead', {}, h('tr', {}, ['时间（上海）', '操作', '目标', '结果元数据'].map(label => h('th', { scope: 'col' }, label)))), h('tbody', {}, logs.map(log => h('tr', {}, h('td', {}, date(log.at, true)), h('td', {}, actionNames[log.action] || log.action), h('td', { class: 'log-id' }, (log.targetIds || []).join('\n') || '—'), h('td', {}, h('pre', {}, json(log.details || {})))))))));
  }

  function configForm(config) {
    const form = h('form');
    const grid = h('div', { class: 'settings-grid' });
    grid.append(h('section', { class: 'settings-section' }, h('h3', {}, '运行开关'), h('p', {}, '开关影响后续处理，不删除已保存的内容。'), toggle('暂停此记忆空间', 'scopePaused', config.enabled === false, '暂停当前工作区与 Agent 的自动记忆处理，优先于各会话开关；既有记录、手动管理和显式导入保留。'), toggle('捕获新记忆', 'captureEnabled', config.captureEnabled, '暂停后不再自动捕获新对话。'), toggle('更新情绪状态', 'moodEnabled', config.moodEnabled, '只接受具有足够置信度的结构化分析。'), toggle('后台整理建议', 'dreamEnabled', config.dreamEnabled, '仅产生待审建议，不自动执行封存或人格变化。'), toggle('提出主动关怀建议', 'proactiveEnabled', config.proactiveEnabled, '只在控制台生成建议，不向外发送消息。')));
    grid.firstElementChild.append(toggle('允许受控语义检索', 'semanticEnabled', config.semanticEnabled !== false, '仅在可见活跃记忆中补充召回线索；最终结果仍受证据、会话和预算校验。'));
    grid.append(h('section', { class: 'settings-section' }, h('h3', {}, '召回与记忆保留'), h('p', {}, '降低召回权重不会删除记忆，封存始终需要审批。'), h('div', { class: 'form-grid' }, field('上下文预算（字符）', 'maxContextChars', config.maxContextChars, { type: 'number', min: 256, max: 16000, step: 1, required: true }), field('每轮最多召回', 'maxRecallItems', config.maxRecallItems, { type: 'number', min: 1, max: 30, step: 1, required: true }), field('记忆权重半衰期（天）', 'halfLifeDays', config.halfLifeDays, { type: 'number', min: 1, max: 36500, step: 1, required: true }), field('封存建议年龄（天）', 'archiveAfterDays', config.archiveAfterDays, { type: 'number', min: 1, max: 36500, step: 1, required: true, hint: '达到天数只进入建议候选。' }), field('每日捕获上限', 'dailyCaptureLimit', config.dailyCaptureLimit, { type: 'number', min: 1, max: 10000, step: 1, required: true, hint: '达到上限跳过新捕获，不淘汰已有记忆。' }))));
    grid.append(h('section', { class: 'settings-section' }, h('h3', {}, '身份与人格底稿'), h('p', {}, '角色身份与用户画像分开保存；记忆内容不改变宿主工具权限。'), h('div', { class: 'form-grid' }, field('身份底稿', 'identity', config.identity, { type: 'textarea', full: true, maxlength: 2000, rows: 3, placeholder: '描述 agent 的身份与基本定位。' }), field('人格底稿', 'persona', config.persona, { type: 'textarea', full: true, maxlength: 2000, rows: 3, placeholder: '描述稳定的表达方式与性格倾向。' }))));
    grid.append(h('section', { class: 'settings-section' }, h('h3', {}, '情绪与安静时段'), h('p', {}, '情绪影响表达与注意，不决定事实真假。'), h('div', { class: 'form-grid' }, field('分析最低置信度', 'minConfidence', config.minConfidence, { type: 'number', min: 0, max: 1, step: 0.05, required: true }), field('情绪半衰期（小时）', 'emotionHalfLifeHours', config.emotionHalfLifeHours, { type: 'number', min: 0.1, max: 720, step: 0.1, required: true }), field('安静时段开始（小时）', 'quietStart', config.quietHours?.start ?? 22, { type: 'number', min: 0, max: 23, step: 1, required: true }), field('安静时段结束（小时）', 'quietEnd', config.quietHours?.end ?? 8, { type: 'number', min: 0, max: 23, step: 1, required: true }), field('关怀建议最小间隔（小时）', 'proactiveIntervalHours', config.proactiveIntervalHours ?? 24, { type: 'number', min: 1, max: 8760, step: 1, required: true }), field('安静时段时区', 'timeZone', config.timeZone || 'Asia/Shanghai', { required: true, maxlength: 100, placeholder: 'Asia/Shanghai' })), h('div', { class: 'emotion-note' }, '安静时段内暂停定时整理，并抑制主动关怀候选；对话完成或手工整理仍可生成普通建议。关怀建议受会话频率限制，只留在控制台。')));
    const submit = button('保存配置', null, { variant: 'primary', type: 'submit', iconName: 'check' });
    form.append(grid, h('div', { class: 'save-bar' }, h('span', {}, '固定规则：不自动删除；封存独立存放；审批后才产生变化。'), submit));
    wireForm(form, submit, async data => {
      const patch = { enabled: data.get('scopePaused') !== 'on' };
      ['captureEnabled', 'moodEnabled', 'dreamEnabled', 'proactiveEnabled', 'semanticEnabled'].forEach(key => { patch[key] = data.get(key) === 'on'; });
      ['maxContextChars', 'maxRecallItems', 'halfLifeDays', 'archiveAfterDays', 'dailyCaptureLimit', 'minConfidence', 'emotionHalfLifeHours', 'proactiveIntervalHours'].forEach(key => { patch[key] = Number(data.get(key)); });
      patch.timeZone = data.get('timeZone').trim();
      patch.persona = data.get('persona'); patch.identity = data.get('identity');
      patch.quietHours = { start: Number(data.get('quietStart')), end: Number(data.get('quietEnd')) };
      await api('/config', { method: 'PATCH', body: patch });
      toast('配置已保存。现有记忆保持完整。');
      await loadPage({ silent: true });
    });
    return form;
  }

  modal.addEventListener('close', () => { importFlow = null; modal.classList.remove('import-dialog'); });
  modal.addEventListener('click', event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });
  $('#refresh-button').append(icon('refresh', 15));
  $('#refresh-button').addEventListener('click', () => loadPage());
  $('#scope-select').addEventListener('change', event => {
    scopeId = event.currentTarget.value;
    scopeEpoch++;
    state = null; pageData = {}; query = ''; kindFilter = ''; emotionFilter = ''; fromFilter = ''; toFilter = ''; entityFilter = ''; sessionId = ''; selectedIsland = ''; archiveTab = 'archive'; memoryOffset = 0; coreOffset = 0; clearSelection();
    if (modal.open) modal.close();
    $('#toast-region').replaceChildren();
    loadPage();
  });
  window.addEventListener('hashchange', () => { if (modal.open) modal.close(); memoryOffset = 0; coreOffset = 0; clearSelection(); loadPage(); });
  try { boot = JSON.parse($('#insideout-boot').textContent); } catch { boot = null; }
  loadPage();
})();
