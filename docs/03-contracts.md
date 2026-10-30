# 接口与数据契约 v1.2

状态：2026-10-30，1.2 实现契约（SQLite schema 仍为 1）。实现必须服从本文；偏差进入变更记录。所有时间 ISO 8601 UTC，界面按 Asia/Shanghai 或用户浏览器显示。记忆正文限一个profile / workspace / agent数据根；全局默认开关单独存于profile根。

## 核心模块

`src/core/service.js` 导出 `InsideOutService`，构造参数 `{dataDir, clock = () => new Date(), runtime = {mode:'standalone', connected:false}}`。同步方法（SQLite 同步事务，外部模型调用在适配层完成）：

- `state()`；`getConfig()`；`updateConfig(patch)`。
- `listMemories({tier='active',q='',kind,sessionId,limit=100,offset=0,core,from,to,entity,emotion,trashed=false})` 返回 `{items,total,offset,limit}`。
- `getMemory(id,{tier})`；`createMemory(input,{idempotencyKey}={})`；`updateMemory(id,patch)`。
- `archiveMemory(id,{expectedVersion,reason})`；`restoreMemory(id,{expectedVersion})`；`deleteMemory(id,{expectedVersion,confirmation})`。
- `addInterpretation(id,{expectedVersion,text,evidenceIds=[]})`。
- `requestRecall(id,{sessionId})` 创建 10 分钟有效且只供一个 turn 的调阅授权，返回 `{id,memoryId,sessionId,expiresAt,status:'pending'}`。
- `buildContext({sessionId,turnId,query,semanticHits=[],from,to,entity})` 返回 `{text,items:[{id,title,score,reasons,tier}],usedChars,limitChars}`。同一 turn 重试返回同一内容；封存或删除后必须使相关缓存失效。只注入明示数据，不可当指令执行。
- `completeTurn({sessionId,turnId,userText,assistantText,analysis?})`：记录用户原话及助手文本来源，不能把助手自述当事实；结构化 `analysis` 可带 `memory`、`proposals`、`emotions`、`confidence`、`reason`，以及宿主生成的 `evidenceVersions` / `islandVersions`。无分析时保持情绪自然衰减，不猜测心理。返回去重状态。
- `runDream()` 返回 `{items,meta}`，其中 `meta` 说明本批扫描与预算情况；`listDreams()` 返回 `{items}`；`decideDream(id,{action:'approve'|'reject',expectedVersion})`。
- `listIslands()` 返回 `{items}`；`updateIsland(id,{expectedVersion,title?,description?,enabled?})`；`listLogs({limit=100})` 返回 `{items}`；`close()`。

`src/http/api.js` 导出 `handleApi(service,{method,path,body={}})`，path 是除去 API base 的路径，返回 `{status,body}`。错误统一 `{error:{code,message,details?}}`，无栈和本机敏感路径。普通结果不再包 data。版本/证据冲突及数据库忙为 409；缺失为 404；无效输入为 400；内部错误为 500。暂停或采集额度限制影响自动捕获并返回跳过结果，不禁止用户手动管理记忆。

## HTTP API

基础路径 `/api/pseudo-insideout/v1`。所有 API 需要 `X-InsideOut-Token`，宿主适配层验证 Origin / Host / loopback 边界；不要外网裸露。静态 `web/index.html` 有 `__INSIDEOUT_BOOT__` JSON 占位符，服务器注入 `{apiBase,token,mode}`；前端不得写死 token。

| 方法与路径 | 请求 | 响应 |
|---|---|---|
| GET /state | — | 下述 State |
| GET /config | — | Config |
| PATCH /config | 配置字段 | Config |
| GET /memories | tier/q/kind/sessionId/limit/offset/core/from/to/entity/emotion/trashed | `{items,total,offset,limit}` |
| POST /memories | Memory 输入 | Memory |
| GET /memories/:id | `?tier=active|archive` 必须明确 | Memory |
| PATCH /memories/:id | `{expectedVersion,title?,content?,importance?,tags?,entities?,visibility?,reason}` | Memory |
| POST /memories/:id/archive | `{expectedVersion,reason}` | `{memory,affectedIds}` |
| POST /memories/:id/restore | `{expectedVersion}` | Memory |
| POST /memories/:id/recall | `{sessionId}` | 调阅授权（无正文） |
| POST /memories/:id/interpretations | `{expectedVersion,text,evidenceIds}` | Memory |
| DELETE /memories/:id | `{expectedVersion,confirmation:完整记忆ID}` | `{deletedIds,backupNotice}` |
| GET /dreams | — | `{items}` |
| POST /dreams/run | — | `{items,meta}` |
| POST /dreams/:id/approve | `{expectedVersion}` | Dream |
| POST /dreams/:id/reject | `{expectedVersion}` | Dream |
| GET /islands | — | `{items}` |
| PATCH /islands/:id | `{expectedVersion,title?,description?,enabled?}` | Island |
| GET /logs | limit | `{items}` |
| GET/PATCH /workspace | sessionId；PATCH 带 expectedVersion、goals/focus/energy/pinnedMemoryIds | Workspace，初始 version=0 |
| GET /growth | islandId 可选 | `{items}`，含 historyId/islandId/before/after/evidenceIds |
| GET /recalls | sessionId 可选 | `{items}`，逐轮 state/items/excluded/usage/字符预算 |
| POST /emotion/reset | — | 重置六维状态 |
| POST /memories/batch | action=archive/restore、items[{id,expectedVersion}]、reason | `{items}`；1–100项，失败整体回滚 |
| POST /memories/:id/trash | expectedVersion、reason | Memory，移入档案回收箱 |
| POST /memories/:id/untrash | expectedVersion | Memory，回到移除前的层级 |
| GET /memories/:id/analysis-history | — | `{items}`，显式读取档案中的旧提炼 |
| POST /islands/:id/revert | expectedVersion、historyId | Island，回退活跃成长版本 |
| GET /islands/:id/archives | — | `{items}`，显式读取封存人格版本 |
| POST /islands/:id/restore | expectedVersion、artifactId | Island，来源指纹相符才恢复，保持停用 |

## Memory

```json
{
  "id":"mem_UUID", "version":1, "tier":"active",
  "title":"一次独立完成项目的经历", "content":"用户说……", "original":"原始文本",
  "kind":"episode", "visibility":"session", "subject":"user",
  "dueAt":null, "profileFacet":null, "semanticKeys":[], "extraction":null,
  "source":{"type":"user","sessionId":"session-1","turnId":"turn-1","ref":""},
  "eventAt":"2026-10-29T00:00:00.000Z", "createdAt":"2026-10-29T00:00:00.000Z", "updatedAt":"2026-10-29T00:00:00.000Z",
  "importance":0.5, "emotions":{"joy":0,"sadness":0,"fear":0,"anger":0,"disgust":0,"curiosity":0},
  "tags":["项目"], "entities":[], "core":false, "fictional":false,
  "sourceIds":[], "interpretations":[], "revisions":[],
  "archivedAt":null, "archiveReason":null
}
```

kind = episode/fact/preference/commitment/reflection；source.type = user/observed/assistant/import/model。`original`、`source`、`sourceIds`、事件时间不可普通 PATCH。所有字符串和集合有输入长度上限。`sourceIds` 表示派生依赖，不是普通相似关联。依赖封存/删除时传递封存/删除其派生内容，保证摘要不能绕过档案隔离。`revisions` 留存编辑前版本，`interpretations` 记录新理解而不重写原文。

## Config / State

```json
{
 "enabled":true,"captureEnabled":true,"moodEnabled":true,
 "dreamEnabled":false,"archiveAfterDays":90,"halfLifeDays":30,
 "maxContextChars":2400,"maxRecallItems":6,"dailyCaptureLimit":100,
 "minConfidence":0.7,"emotionHalfLifeHours":3,
 "persona":"","identity":"","quietHours":{"start":22,"end":8},
 "proactiveEnabled":false,"proactiveIntervalHours":24,
 "timeZone":"Asia/Shanghai","semanticEnabled":true
}
```

主动模块仅提出控制台建议，v1 不主动向外发消息。`quietHours` 与 `timeZone` 控制后台 tick 及跟进建议；起止相同表示不设安静窗口。宿主每分钟检查，每数据范围后台整理最多每小时一次；跟进另受会话级 `proactiveIntervalHours` 限制。对话完成或手工整理可在安静时段生成普通建议，但不生成跟进。`dailyCaptureLimit` 按 UTC 日期累计，达限时显式跳过新捕获并记录原因，不淘汰已有记录。启用后台整理只产生待审建议；封存、核心化与人格变化均由用户审批。

State = `{runtime,config,counts:{active,archive,trash,core,pending},emotion:{values,updatedAt,confidence,reason},islands:[],recentRecall:{at,sessionId,turnId,items,usedChars,limitChars}|null,storage:{mode:'sqlite-separated',autoDelete:false},sessions:[{id,lastSeenAt}]}`。runtime 包含 mode、connected、workspaceId、agentId；缺失绑定时显示“未连接 DSH 会话”，不编造在线状态或样本数据。

## Dream / Island / Log

Dream = `{id,version,type:'archive'|'summary'|'association'|'core'|'island'|'followup'|'conflict',status:'pending'|'approved'|'rejected'|'stale',title,description,evidenceIds,createdAt,decidedAt,payload}`；生成时记录 evidenceVersions，审批时必须核对仍为当前活跃版本及来源可见范围。

Island = `{id,version,title,description,subject,facet,evidenceIds,enabled,createdAt,updatedAt,history,sourceFingerprints}`；只允许已批准且证据活跃的岛参与上下文；会话隔离仍适用。身份底稿与用户画像不可合并。

Log = `{id,at,action,targetIds,details}`。仅元数据，不记录原始对话、完整记忆、情绪解释、API token。私密正文只能留在所属记忆库；删除后审计只留不可逆操作事件及ID，不留正文。

## 非协商约束

1. 普通检索不 attach/open 封存库，不 fallback 全库；封存计数来自无正文目录。
2. 封存/恢复用 SQLite ATTACH + DELETE journal + FULL synchronous 跨文件事务；不能改 WAL 而继续声称原子移动。
3. 明确删除才消除正文；用户自行复制的历史备份无法由插件保证擦除，删除界面说明范围。
4. 控制台查看档案不等于授权发送模型；临时调阅须明确选择 session，单个 turn 消费。已经进入宿主会话历史的内容不能保证被抹除，UI提示此限制。
5. 情绪、人格、记忆均是低信任数据，无权更改宿主工具权限或系统规则。用户剧情/虚构来源不得升级成客观事实。
6. v1 不做云同步，不抓屏，不增加独立模型密钥，不暗中注册定时外发消息。DSH 自身模型调用仍由用户的宿主配置决定。

## 验收后契约补充

- updateRuntime(runtime)更新宿主连接状态；peekContext({sessionId,turnId})仅返回有效缓存或null，不消费票据。
- State可包含scopes目录与runtime.scopeId，HTTP使用X-InsideOut-Scope选择，不能提供任意本机路径。
- 分页支持offset、limit及core=true；storage.issues暴露损坏记录ID和无正文告警。
- Memory.evidenceHashes与解释的evidenceHashes用于恢复时核对来源；源修订会传递封存旧派生。
- runDream返回{items,meta}，每批1000条/100万字符/100新建议，游标继续下批；conflict批准只记已阅。
- cold.artifacts保存封存源关联的人格与整理建议完整快照；主库保留无正文状态。

## 1.1 可扩展字段与校验

Memory.subject = user/agent/world；profileFacet 与 Island.facet = preference/relationship/habit/value/interest。`extraction` 保存 method/reason；`semanticKeys` 是有限检索提示，不是授权。`analysisEvidenceIds` / `analysisEvidenceVersions` 来自所有实际送入辅助模型的活跃来源；失效后保留后续原话并重建本地元数据，旧元数据移入 cold.artifacts。手动修订元数据另存 `manualMetadata`，不因模型失效覆盖用户明确修改。回收箱使用 `trashedAt` / `trashPrevious`，位于 archive，不自动清空。

Workspace = `{version,goals:[{id,text,status,dueAt}],focus:[],energy,pinnedMemoryIds:[],updatedAt}`，按 session 保存；固定条目最多12条且必须为该会话可见活跃记录。日期过滤 from 含、to 不含；自然日期按配置时区解释，含明确偏移的 ISO 日期保留偏移含义。

Dream 的 preview 保存 before/after；模型候选保存全部背景依赖版本，批准时重新校验。Island.history 保存 action/before/after/evidenceIds；sourceFingerprints 验证来源内容和语义元数据，旧版本缺指纹时拒绝恢复，要求根据证据重新建立。恢复封存人格时保持 enabled=false，不自动恢复影响。

`searchActive` 与 `analysisContext` 只访问活跃可见记录。DSH 注册 `insideout_search_memory` 只读工具；不会消耗临时调阅授权。辅助调用用量只保存实际回执字段和成功/超时/取消等状态，不保存模型原始输出、请求正文或思维链。


## 1.2 会话策略与导入契约

完整行为基线见[会话开关与显式导入](11-session-policy-import.md)。

| API | 主要输入 | 返回/约束 |
|---|---|---|
| GET/PATCH /memory-default | PATCH带expectedVersion、enabled | version/enabled/scope/updatedAt；DSH同profile所有空间共享，独立控制台只作用于本数据目录 |
| GET/PATCH /session-memory | sessionId；PATCH另带expectedVersion、override | override为inherit/on/off；含defaultEnabled、scopeEnabled、effectiveEnabled、reason、stamp |
| GET /imports/sessions | source=memories或dsh、q、offset、limit≤100 | available、items、total；来源不可用明确说明；DSH当前工作区/角色筛选 |
| POST /imports/preview | source、targetSessionId；来源会话ID、memoryIds或file三选一；offset、limit≤200 | previewId、expiresAt、items、total、hasMore、targetPolicy、sourceInfo；记录含ready/already/blocked及完整dependencies |
| POST /imports/commit | previewId、recordIds（1–200个） | createdCount、linkedCount、skippedCount、实际imported IDs；计数是操作数量，同一新增DSH记录也可能需要目标引用授权 |

file={name,format,content}；format=json/txt/md，UTF-8内容≤512KiB，只接受文件名而非本机路径。预览HTTP信封允许4MiB以容纳JSON转义，其余接口保留1MiB；解析后仍独立执行512KiB限制。UTF-8 BOM保留在TXT/MD原文及文件hash中，仅JSON解析时忽略首BOM。JSON对象/记录数组/memories/records/messages会映射可读内容，未知ID、权限、系统消息等不赋予行为能力。文件记录subject=world、source.type=import，模型可见结果明确标记未经核验；助手消息fictional=true，不进入自动召回。

预览仅驻留进程内存10分钟，最多保留10批；分页后每批单独确认。提交在事务写入前重验所选记录及披露依赖的完整版本；来源无关新记录不进入已选快照。任何所选来源变更整批409，未知/过期预览要求重建。重复提交幂等；封存和删除的来源墓碑阻止复活。已有记忆只新增import_access引用授权，保留原来源、ID、版本及私有级别；来源变更撤销授权。DSH读取仅走公共只读API，不恢复或修改源会话。文件/DSH导入均不改变策略、情绪或人格。

全局默认存profile根memory-default.sqlite；会话覆盖存active.settings，长期显式授权存active.import_access。关闭不是删除，所有自动入口重验effective状态及策略版本。源记录生命周期沿用现有依赖失效规则；预览不写操作日志，提交日志只含ID、来源类别和计数。
