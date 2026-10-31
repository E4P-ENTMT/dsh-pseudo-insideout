# 1.2 会话记忆开关与显式导入

[文档导航](README.md) · [当前交付状态](08-delivery-report.md)

> 本文中的 1.0–1.2 为历史开发阶段编号；当前包版本为 `0.0.1`。验收结果仅适用于记录中注明的工件与执行范围。

2026-10-30。用户要求：全局默认记忆开关、单个session开关、额外导入指定session或记录；随后确认同时支持JSON、TXT和Markdown文件。

## 行为基线

- 全局默认作用于当前DSH profile的全部工作区/Agent记忆空间；独立控制台作用于其数据目录。新旧无覆盖会话均继承最新默认，单会话可选inherit/on/off。现有空间enabled是硬暂停，不被会话on绕过。关闭不删除旧记录。
- 关闭阻止自动采集、上下文、只读模型工具和辅助分析。缓存立即失效，进行中辅助调用取消，迟到结果和同回合off→on不能恢复采集；新开启从下一完整回合开始。手动控制台管理和显式导入仍允许，不隐式开启记忆。
- 已有记忆导入使用针对目标session的显式引用授权，保留原ID/来源/私有级别，不变成workspace共享。整会话是当时所选活跃记录快照，不跟随未来新增。展示所需依赖闭包；源修订/封存/回收/删除撤销授权并按已有来源链处理派生结论。
- DSH历史导入通过官方公共只读查询，限定当前workspace/Agent，排除继承、shadowed、非真人、未完成和工具/推理正文；不resume、不改源session。当前宿主可见session目录可能来自同DSH_HOME，不能称为profile隔离目录。
- JSON/TXT/Markdown只读取用户明确选择或粘贴的内容，最大512KiB UTF-8。JSON支持记录对象/数组、memories/records或messages数组；只映射可读字段，权限/指令/ID不进入系统行为。普通文件以外部参考来源保存，不当成已核实的用户事实；助手消息标记虚构来源。原文及文件名/hash保留。
- 所有导入先预览、选择，再明确提交；每批最多200条，展示分页与总量。所选来源或依赖变化整批拒绝，无部分写入；无关追加记录不改变已选快照；重复导入幂等，已经封存/删除的原记录不被重新建立。DSH历史仅用本地规则提炼；文件只映射可读字段、保留外部参考归属。两者均不调用模型、不改情绪、不自动批准人格。
- 预览在内存中保留10分钟，不写原始日志；源变化使相关预览失效。操作日志只存IDs与计数。当前不提供单独撤销导入授权功能；来源生命周期操作和会话开关仍生效。

## 接口

- GET/PATCH /memory-default：version、enabled、scope、updatedAt；修改带expectedVersion。
- GET/PATCH /session-memory：sessionId、version、override、defaultEnabled、effectiveEnabled、scopeEnabled、reason、stamp。
- GET /imports/sessions?source=memories|dsh&q=&offset=&limit=50：独立来源目录，unavailable明确返回。
- POST /imports/preview：source、targetSessionId；记忆源指定sourceSessionId或memoryIds；DSH指定sourceSessionId；文件指定file{name,format,content}；offset/limit≤200。
- POST /imports/commit：previewId、recordIds；返回createdCount/linkedCount/skippedCount与实际记录ID。

全局默认存profile根的memory-default.sqlite，session覆盖与引用授权在各scope active库，不保存额外正文。现有schema 1作可加表/JSON字段扩展；未知未来schema仍拒绝。

## 验收

验证跨scope默认/重启、三态覆盖、硬暂停、即时缓存和工具关闭、异步竞争、正常下一回合恢复；验证导入选择边界、依赖闭包、幂等、变更竞争、封存删除防复活；验证文件解析/来源/原文/超限及浏览器预览提交。完整官方DSH再验证真实session目录/历史读取与最终安装包，分别标注合成供应商和未测边界。
