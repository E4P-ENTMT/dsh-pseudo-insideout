# 安装、运行、停用与维护

## 交付与支持范围

`dsh-pseudo-insideout` 是 DSH Cordis bundle，包含真实宿主入口和浏览器半端，不是单独网页套壳。运行时代码使用 Node 内置模块，没有另外的 API 密钥或运行期 npm 依赖；开发测试使用官方 Cordis、DSH SystemPrompt、工具注册器与 NativeToolExecutor 包。

0.0.1 针对 **DSH `0.2.2-alpha.2` 的 Web profile** 编写，要求 **Node `>=24.9.0`**。`package.json` 中 `engines.dsh` 精确锁定这个版本。已用真实 Cordis `4.0.6-alpha.1`、官方 `SystemPrompt`、scope 与工具组件验证注册、提示组装、执行和卸载；也已在隔离目录通过真实 DSH CLI 安装本地 tgz、启动完整 Web 宿主，并连接本机合成 SSE 提供商验证真实会话的捕获、召回、工具调用、用量记录与会话隔离。合成提供商不证明真实供应商的理解质量、费用或网络表现；真实供应商与 DSH Desktop 原生壳尚未验证，详见 [宿主验收记录](host-validation.md)。其他 DSH 版本不在已验证范围内。

## 安装本地包

先在 DSH 所用终端确认版本：

```sh
dsh --version
node --version
```

将交付的 `dsh-pseudo-insideout-0.0.1.tgz` 安装进现有的 Web profile。升级前按下文备份整个记忆空间；新增开关与导入能力见 [1.2 会话记忆策略](11-session-policy-import.md)。以下 `YOUR_WEB_PROFILE` 替换为自己的 profile 名，包路径使用实际绝对路径：

```sh
dsh plugin --profile YOUR_WEB_PROFILE add /absolute/path/dsh-pseudo-insideout-0.0.1.tgz
dsh --profile YOUR_WEB_PROFILE --dump-config
```

配置应包含 bundle `dsh-pseudo-insideout` 与行 `pseudo-insideout`。随后重新启动该 Web profile：

```sh
dsh --profile YOUR_WEB_PROFILE
```

在 DSH 设置中选择 **“记忆总部 · Pseudo Inside Out”**，或在同一个本机 DSH 地址下打开 `/pseudo-insideout/`。首次没有会话时显示未连接；创建/打开根会话后，控制台会出现对应记忆空间。插件停用再启用不删除数据库。

本机访问只接受 `localhost`、`127.0.0.1` 或 `[::1]` 的 Host 与 loopback socket。自定义域名、代理出口、局域网和远程连接会被拒绝；不要通过修改成 `0.0.0.0` 来开放控制台。

## 从源码验证与打包

在源码根目录执行：

```sh
npm ci --ignore-scripts
npm test
npm pack --dry-run
npm pack
```

代码已是 ESM JavaScript，客户端工厂已经写成 DSH 支持的格式，不依赖 git 安装后执行 `prepare`。`npm pack` 的包内不包含 `node_modules`、测试数据库或用户记忆。

独立预览可使用：

```sh
npm start
```

预览入口输出的本机地址是控制台与核心的演示运行，不表示已经连接 DSH。预览数据与 DSH 数据独立，runtime 明确显示 standalone/未连接。

## 宿主选项

在 profile 的 `cordis.patch.yml` 对同一行覆盖配置；DSH 覆盖 `config` 是整体替换，因此填写希望保留的全部选项：

```yaml
- id: pseudo-insideout
  config:
    analyzeTurns: true
    allowedSourceKinds:
      - user
```

- `analyzeTurns` 默认 `true`：成功回合后，只要捕获或情绪功能仍启用，就借用当前会话的宿主模型作一次结构化提炼。一次请求的输出上限为 **3000 token**，等待预算为 **15 秒**；可产生类型、重要度、主题、实体、日期、用户画像候选和模拟情绪，整理开启时还可提出待审建议。`moodEnabled:false` 只停止情绪更新，捕获开启时仍会提炼记忆。模型不可用、输出无效、超时或取消时，捕获开启的空间仍保留已完成回合原话并使用保守本地规则；推断不等于事实核验。
- `allowedSourceKinds` 默认只接受 `user`。桥接插件、定时事件和第三方注入不能默认冒充真人发言。如果确实要捕获某桥接源，核对该插件真实 source.kind 后显式加入。
- `dataDir` 可选，指定本地数据基目录；内部仍追加 profile hash，不能用于跨 profile 共享。默认在 DSH home 的 `pseudo-insideout` 下。
- `profileId` 仅供不由正常 DSH profile launcher 启动的受控测试组合；正常安装直接使用 `ctx.profileContext.dir`，不要随意修改。

控制台中的捕获、情绪、整理、语义检索与总开关分别作用于选中的记忆空间。关闭捕获不自动删除已存记录。插件不会自动改写身份底稿；用户画像提案与 agent 的身份、人格设定分开。

### 辅助模型调用与关闭方式

`semanticEnabled` 是控制台“允许受控语义检索”开关，默认 `true`。轮前有用户问题和活跃可见候选时，每个会话每轮最多调用一次宿主模型，输出上限 **1200 token**，等待预算 **5 秒**；失败回退到本地检索。候选最多 30 条、候选序列化预算 16000 字符；封存记录和其他会话的私有记录不进入该候选集。每步实际注入仍受当前会话、版本、日期、实体和上下文预算校验。只读 `insideout_search_memory` 工具自身执行本地检索，不额外调用模型，也不使用临时档案授权。

**`analyzeTurns:false` 不会关闭 `semanticEnabled:true` 的轮前调用。**若要保留本地记忆功能并关闭插件的全部额外模型调用，需要同时：

1. 在宿主 `cordis.patch.yml` 中把 `analyzeTurns` 设为 `false`，并保留同一 `config` 中需要的其他选项。
2. 在每个相关记忆空间的控制台关闭“允许受控语义检索”（`semanticEnabled:false`）。新建空间默认仍为开启，需要另行设置。

这两个开关只控制本插件的辅助调用，不关闭 DSH 正常对话所使用的主模型。两类辅助调用使用会话当前模型和宿主凭据，可能产生额外费用；用量只展示提供商实际返回的 token 计数，不估算货币成本。输入合计包括未缓存输入、缓存读取和缓存写入；提供商未返回的字段不按零补齐。

辅助提炼只发送本轮用户原话和预算内的活跃背景。助手回复保存在原始回合记录中，不再传入辅助分析；人格岛只传标识、版本、归属和证据 ID。全部背景正文附真实版本，来源修订、封存或移除后不能继续沿用旧推断。

### 本地整理、时区与跟进

默认 `dreamEnabled:false`、`proactiveEnabled:false`、`timeZone:Asia/Shanghai`、安静时段 `22:00–08:00`、跟进最小间隔 `24` 小时。在控制台开启“后台整理建议”后，宿主每 **60 秒**检查已发现的真实记忆空间；定时整理只在总开关开启且不处于安静时段时运行，同一空间两次定时整理至少间隔 **1 小时**。这些检查随宿主运行，停机期间不会运行，也不是外部定时服务；插件卸载会取消定时器。

开启整理后，完成回合也会运行一次本地整理；控制台可手动“整理一次”。普通整理只生成待审建议，安静时段不会阻止手动整理或回合后的普通建议。主动跟进还要求 `proactiveEnabled:true`，并始终检查安静时段、约定到期时间与会话频率；未写明到期日的约定也可列为待检查事项。同一会话新建跟进建议的间隔至少为 `proactiveIntervalHours`（默认 24 小时，可设 1–8760 小时），已有相同建议不会重复创建。**跟进只形成控制台待办，不自动发送消息，也不自动执行工具。**

`timeZone` 接受有效 IANA 时区，例如 `Asia/Shanghai`；它用于本地日期解析、传给辅助模型的相对日期参考和安静时段判断。安静时段含开始小时、不含结束小时，允许跨午夜；起止相同表示不设安静时段。没有明确日期或存在无法可靠解释的时间时，不保证生成精确提醒。

## 数据位置与隔离

默认路径：

```text
$DSH_HOME/pseudo-insideout/<profile-hash>/
  scopes.json                        # 无原文的空间目录
  <workspace-and-agent-hash>/
    active/insideout.sqlite           # 活跃记忆与状态
    archive/insideout.sqlite          # 独立封存原文
```

`DSH_HOME` 未设置时通常为 `~/.dsh`；正常 profile 以宿主提供的 home 为准。工作空间来自 `session.header.cwd`，角色来自 `agentPreset`。同一空间内部默认按 session 隔离，明确标记 workspace 共享的记忆才进入其他会话的候选范围。子 agent 不捕获。

`scopes.json` 只保存安全 hash 与工作区/角色元数据，用于重启后浏览已有空间；API 不接受任意磁盘路径，不通过用户提供的 cwd 选择数据库。没有活跃会话时的 unbound 空间独立，内容不会自行搬进真实会话。

## 封存、临时调阅与删除

封存是把正文及历史版本移入独立数据库，日常召回不连接档案库。控制台浏览档案不会将它发送给模型。临时调阅须选择会话，由下一次符合条件的回合认领；同回合重试可重用，其他回合不能再使用，且不恢复活跃。

**DSH 会把已注入的上下文写入自己的会话历史。**插件可以停止以后重新注入，但无法承诺把已经存在于宿主历史的文本抹除。需要清理宿主历史时，应使用 DSH 自己的会话管理功能。

真正删除仅由用户明确提交完整 ID 后发生。插件自身删除范围不包括用户过去另存、导出或系统备份中的副本。

## 停用、卸载与升级

可在 DSH 插件管理器停用，或移除 bundle：

```sh
dsh plugin --profile YOUR_WEB_PROFILE remove dsh-pseudo-insideout
```

卸载清理监听、提示贡献、只读工具、路由、定时器和辅助模型调用；已完成回合的待处理原话先落盘，再关闭 SQLite。数据目录保留，便于重新安装继续使用。

升级前先停用插件/停止宿主，显式复制整个对应 profile 数据目录到用户选择的备份位置，活跃与封存数据库应一起复制。不要只复制活跃库，也不要在写入中复制部分 SQLite 文件。备份包含记忆原文，应按私人资料管理。

本版使用 SQLite `user_version`。遇到比本程序更新的未知版本拒绝写入，不猜测降级转换。回滚代码前确认 schema 兼容；不兼容时使用升级前完整备份，并保留新数据目录供人工核对。

## 首次真实宿主验收

1. 载入插件，在设置里看到控制台；空状态明确未连接，不出现演示记忆。
2. 打开根会话，完成一轮正常对话，查看相同 session 的记忆与来源；中止/失败回合不冒充已完成经历。
3. 新一轮提及相关内容，查看本轮召回记录。
4. 封存该条目，确认活跃列表和新召回中消失，档案馆仍保留原文。
5. 显式临时调阅后在指定会话使用一次，再下一轮不再新增注入；恢复活跃后才重新参与日常召回。
6. 切换其他工作区/角色，确认记忆空间分离；重启后数据仍在。
7. 停用插件，确认入口、路由与上下文贡献撤销。

这些步骤用于目标机器的完整宿主验收；本地测试报告不替代真实 DSH 应用验收。

## 显式一致备份工具

使用交付的 `node scripts/backup.js create --from <单个数据根> --to <全新备份目录>`，可在双库事务锁下生成一致快照；restore命令同样要求新目标，校验SHA-256和数据库完整性并清除调阅授权。完整用法见README。此方法与上面的停机整目录复制二选一。


## 1.2 开关、导入与升级

全局默认适用于同一DSH profile中所有记忆空间；会话工作台可选择继承、单独开启或单独关闭。旧版空间enabled保留为硬暂停，会话开启不能绕过它。关闭保留旧记录，同时停止该会话的新捕获、上下文、记忆工具和辅助模型；中途重开从下一完整回合恢复。显式导入及控制台管理仍可使用。

记忆大厅支持导入已有活跃记录、DSH历史和用户选择的JSON/TXT/Markdown文件。先指定目标会话，预览并选择后提交。文件上限512KiB、每批200条；导入不改变会话开关、不调用模型，文件内容是未经核验的外部参考。已有记录保留ID与来源，通过会话授权共享；源修订/封存/删除撤销授权。DSH历史通过宿主公共只读接口查询，限制当前工作区与角色，不恢复或修改源会话。目录来自当前宿主可见会话，不保证按profile分隔。

升级保留schema 1，按需添加授权表和JSON字段；旧记录无需重建。全局默认首次为开启，现有空间硬暂停仍有效。DSH profile数据根新增memory-default.sqlite，各空间覆盖/授权在active库。备份脚本继续备份单空间双库，保留会话覆盖和长期显式导入授权，恢复只清除旧临时调阅授权；它不备份profile根默认库。整体迁移需停用宿主并保留完整profile数据根（含默认库与scopes.json）。
