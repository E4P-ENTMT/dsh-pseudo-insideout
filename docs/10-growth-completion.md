# 1.1 成长能力补齐设计基线

[文档导航](README.md) · [当前交付状态](08-delivery-report.md)

> 本文中的 1.0–1.2 为历史开发阶段编号；当前包版本为 `0.0.1`。验收结果仅适用于记录中注明的工件与执行范围。

2026-10-30。用户要求继续完成最初设计与实现之间的差距。本轮按需求、接口、实现、验证、打包推进，不能用较窄的 1.0 范围替代最初目标。

## 目标与约束

1. 普通完成对话自动形成有来源的类型、重要度、主题、实体、日期与候选人格维度。模型提炼失败时使用保守离线规则，原话永远单独保存；推断不成为事实核验。
2. 检索增加宿主模型的语义选择、明确日期/人物条件、有限概念扩展离线回退和只读活跃记忆工具。封存库仍只允许明确调阅。
3. 整理支持不同表述的经验归纳、关联建议、证据支持的偏好/关系/习惯/价值/兴趣提案。批准前校验证据版本，拒绝跨会话及从私有到共享的提升。人格改变保存版本，可回退；不自动改身份。
4. 会话工作台保存目标、关注点、精力、固定工作记忆；当前情绪给出表达和注意建议并参与有限排序，不改变权限或真假。
5. 按轮显示实际注入状态、入选/落选依据及模型用量。来源封存/修订/删除时清除活跃派生正文和旧快照，禁止记录旁路。
6. 控制台提供日期球体/混色情绪、人格地图/成长记录、可读变更对照、全库过滤与批量操作。
7. 可恢复移除使用独立档案库中的回收箱，不自动清空；永久删除仍是另一个完整 ID 确认操作。无隐蔽撤销副本。
8. 跟进仅形成控制台待办：检查到期日期、安静时段、频率，后台定时器随插件卸载取消。没有自动对外发信。

## 增补接口

- `GET/PATCH /workspace?sessionId=...`：`version, goals[{id,text,status,dueAt}], focus[], energy, pinnedMemoryIds[], updatedAt`。PATCH 带 sessionId 和 expectedVersion；初始版本 0。
- `GET /growth?islandId=...`；`POST /islands/:id/revert {historyId,expectedVersion}`。人格维度：preference/relationship/habit/value/interest。
- `GET /recalls?sessionId=...` 返回逐回合 items/excluded/state/usage 与字符预算。
- `POST /emotion/reset`。
- `GET /memories` 增加 from（含）/to（不含）/entity/emotion/trashed 过滤；`POST /memories/batch` 支持原子 archive/restore。
- `POST /memories/:id/trash` 与 `/untrash`；原永久 DELETE 接口不变。
- Config 新增 semanticEnabled、proactiveIntervalHours、timeZone。
- `analysisContext` 与 `searchActive` 只读活跃可见记录；模型语义命中必须再次通过范围、证据、日期校验。

数据库沿用 schema 1 的 JSON 可扩展记录和 settings；旧数据缺省字段在读取时补默认，新增历史保存在所属人格岛和回合快照中，不迁移或覆盖旧原文。任何后续不兼容布局必须另做版本迁移。

## 验收门槛

新增用正常对话驱动而非人工补标签的成长测试，覆盖模型结构校验和离线降级、语义命中范围隔离、证据修订竞争、时间过滤、情绪重置、人格回退、回收箱恢复、批量失败回滚、安静时段与频率、归档后历史正文隔离。保留已有硬约束回归，使用真实 DSH 工具注册与宿主安装、浏览器操作验收。

在线供应商、跨系统支持与屏幕阅读器覆盖只在实际执行后报告通过。执行结果见下节。

## 实现与验收结果

2026-10-30，版本1.1.0。上述八组目标均有可执行路径；对应源码为 core/service.js、core/intelligence.js、dsh/host.js、http/api.js 和 web/。在原有封存不变量上补充了全部模型背景来源依赖、用户画像/agent人格分离、提炼历史显式封存、人格恢复指纹与回收箱事务。

自动测试78/78通过，其中新增或扩展覆盖自动提炼、时区/DST、语义选择、工作台、成长回退、来源变化、数据库残留、真实官方工具执行及定时器清理。完整固定DSH宿主配合本机合成SSE供应商，验证真实完成回合、下一轮注入、另一会话排除、native工具和回执用量。浏览器验证成功恢复新版封存人格，恢复后保持停用；旧无指纹版本明确失败。

详细追踪见 [验收矩阵](05-acceptance.md)、[该阶段交付报告](history/08-delivery-1.1.0.md)、[宿主验证](host-validation.md)、[UI验证](ui-validation.md)。该阶段最终工件为 `dsh-pseudo-insideout-1.1.0.tgz`；最终包证据在 `output/delivery/1.1.0/`。真实商业供应商质量/费用、跨系统及完整屏幕阅读器覆盖仍未执行，不据此声称通过。
