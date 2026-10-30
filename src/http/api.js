import { InsideOutError } from '../core/service.js';

/** Transport independent router. Authentication belongs to the HTTP/DSH transport. */
export function handleApi(service, { method = 'GET', path = '/', body = {} }) {
  try {
    const url = new URL(path, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new InsideOutError('INVALID_BODY', '请求必须是 JSON 对象');
    const query = Object.fromEntries(url.searchParams);
    let result;
    if (parts.length === 1 && parts[0] === 'state' && method === 'GET') result = service.state();
    else if (parts.length === 1 && parts[0] === 'memory-default' && method === 'GET') result = service.getMemoryDefault();
    else if (parts.length === 1 && parts[0] === 'memory-default' && method === 'PATCH') result = service.updateMemoryDefault(body);
    else if (parts.length === 1 && parts[0] === 'session-memory' && method === 'GET') result = service.getSessionMemory(query);
    else if (parts.length === 1 && parts[0] === 'session-memory' && method === 'PATCH') result = service.updateSessionMemory(body);
    else if (parts.length === 2 && parts[0] === 'imports' && parts[1] === 'sessions' && method === 'GET') {
      if (query.source === 'dsh') result = { available: false, source: 'dsh', reason: '当前未连接 DSH 历史查询服务；仍可导入已有记忆或文件。', items: [], total: 0, offset: 0, limit: 50 };
      else if (!query.source || query.source === 'memories') result = service.listImportSessions(query);
      else throw new InsideOutError('INVALID_IMPORT_SOURCE', '请选择已有记忆或DSH会话来源');
    }
    else if (parts.length === 2 && parts[0] === 'imports' && parts[1] === 'preview' && method === 'POST') result = service.previewImport(body);
    else if (parts.length === 2 && parts[0] === 'imports' && parts[1] === 'commit' && method === 'POST') result = service.commitImport(body);
    else if (parts.length === 1 && parts[0] === 'config' && method === 'GET') result = service.getConfig();
    else if (parts.length === 1 && parts[0] === 'config' && method === 'PATCH') result = service.updateConfig(body);
    else if (parts.length === 1 && parts[0] === 'workspace' && method === 'GET') result = service.getWorkspace(query);
    else if (parts.length === 1 && parts[0] === 'workspace' && method === 'PATCH') result = service.updateWorkspace({ ...query, ...body });
    else if (parts.length === 1 && parts[0] === 'growth' && method === 'GET') result = service.listGrowth(query);
    else if (parts.length === 1 && parts[0] === 'recalls' && method === 'GET') result = service.listRecalls(query);
    else if (parts.length === 2 && parts[0] === 'emotion' && parts[1] === 'reset' && method === 'POST') result = service.resetEmotion();
    else if (parts.length === 2 && parts[0] === 'memories' && parts[1] === 'batch' && method === 'POST') result = service.batchMemories(body);
    else if (parts.length === 3 && parts[0] === 'islands' && parts[2] === 'archives' && method === 'GET') result = service.listArchivedIslands(parts[1]);
    else if (parts.length === 3 && parts[0] === 'islands' && parts[2] === 'restore' && method === 'POST') result = service.restoreIsland(parts[1], body);
    else if (parts.length === 3 && parts[0] === 'memories' && parts[2] === 'analysis-history' && method === 'GET') result = service.listAnalysisHistory(parts[1]);
    else if (parts.length === 3 && parts[0] === 'islands' && parts[2] === 'revert' && method === 'POST') result = service.revertIsland(parts[1], body);
    else if (parts.length === 1 && parts[0] === 'memories' && method === 'GET') result = service.listMemories(query);
    else if (parts.length === 1 && parts[0] === 'memories' && method === 'POST') result = service.createMemory(body);
    else if (parts.length === 2 && parts[0] === 'memories' && method === 'GET') result = service.getMemory(parts[1], query);
    else if (parts.length === 2 && parts[0] === 'memories' && method === 'PATCH') result = service.updateMemory(parts[1], body);
    else if (parts.length === 2 && parts[0] === 'memories' && method === 'DELETE') result = service.deleteMemory(parts[1], body);
    else if (parts.length === 3 && parts[0] === 'memories' && method === 'POST') {
      const functions = { archive: 'archiveMemory', restore: 'restoreMemory', recall: 'requestRecall', interpretations: 'addInterpretation', trash: 'trashMemory', untrash: 'untrashMemory' };
      if (functions[parts[2]]) result = service[functions[parts[2]]](parts[1], body);
    }
    else if (parts.length === 1 && parts[0] === 'dreams' && method === 'GET') result = service.listDreams();
    else if (parts.length === 2 && parts[0] === 'dreams' && parts[1] === 'run' && method === 'POST') result = service.runDream();
    else if (parts.length === 3 && parts[0] === 'dreams' && ['approve', 'reject'].includes(parts[2]) && method === 'POST') result = service.decideDream(parts[1], { ...body, action: parts[2] });
    else if (parts.length === 1 && parts[0] === 'islands' && method === 'GET') result = service.listIslands();
    else if (parts.length === 2 && parts[0] === 'islands' && method === 'PATCH') result = service.updateIsland(parts[1], body);
    else if (parts.length === 1 && parts[0] === 'logs' && method === 'GET') result = service.listLogs(query);
    if (result === undefined) return { status: 404, body: { error: { code: 'NOT_FOUND', message: '接口不存在或方法不支持' } } };
    return { status: method === 'POST' && parts.length === 1 && parts[0] === 'memories' ? 201 : 200, body: result };
  } catch (error) {
    if (error instanceof InsideOutError) return { status: error.status, body: { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } } };
    if (error.code === 'ERR_SQLITE_ERROR' && /locked|busy/.test(error.message)) return { status: 409, body: { error: { code: 'STORAGE_BUSY', message: '数据库忙，请稍后重试' } } };
    return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: '操作失败且未确认成功。请检查存储空间和插件诊断。' } } };
  }
}
