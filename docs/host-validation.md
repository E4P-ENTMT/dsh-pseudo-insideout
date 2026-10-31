# 真实 DSH 宿主验收记录

[文档导航](README.md) · [当前交付状态](08-delivery-report.md)

> 本文中的 1.0–1.2 为历史开发阶段编号；当前包版本为 `0.0.1`。验收结果仅适用于记录中注明的工件与执行范围。

日期：2026-10-29 起（Asia/Shanghai）。本记录区分真实宿主运行、官方组件集成测试及尚未验证的部分。以下至“独立浏览器补测”为 1.0 历史记录；1.1 的新增验证和最终包复验方式见文末。

## 隔离环境

- 平台：macOS / darwin arm64；Node `v26.13.0`。
- 实际安装：npm 官方包 `@deepseek-ai/dsh@0.2.2-alpha.2`，安装成功，共 654 个包；首次使用 `--ignore-scripts` 即可启动。
- CLI 实际输出版本：`0.2.2-alpha.2`。
- 实际 Web boot manifest release：`version=0.2.2-alpha.2`、`commit=d21f653`。
- 源码接口研究用 master 固定 SHA `f3803c96974ad4a94195fb97e5c637e9c2a3afe3`；它与已发布 npm 包的内置 commit 不同，因此运行结果以 npm 包为准。
- runtime、DSH_HOME、DSH_AGENTS_HOME、工作目录、profile 和全部验收记忆位于同一专用临时目录。
- 没有读取或修改用户原有 `~/.dsh`；运行子进程只继承必要系统环境变量，未继承模型密钥。
- 设置 `DSH_TELEMETRY_DISABLED=1`、`DSH_TELEMETRY_MODE=DISABLED`，插件覆盖 `analyzeTurns:false`；没有配置或调用真实模型。
- 本次未发布 npm 包，也未把插件安装进用户已有 profile。
- 此次真实宿主安装使用实现阶段临时 tgz；SHA-256：`9257962abb42d2d941e276e936de7e23a297c9343fd0a9ea5a21a5177b63a9fd`。最终交付包仍需在所有修复与文档完成后重新打包；最终包哈希以交付清单为准。

## 实际操作与结果

| 检查 | 真实运行结果 |
| --- | --- |
| `dsh --version` | 通过：`0.2.2-alpha.2` |
| `dsh --profile web --dump-config` 首次初始化 | 通过：临时 Web profile 由官方模板建立 |
| `dsh plugin --profile web add <本地tgz>` | 通过：官方 plugin 命令接受 bundle manifest；pnpm 成功安装 1 个本插件包 |
| profile manifest | 通过：bundles 包含官方 base、web-app 和 `dsh-pseudo-insideout` |
| 安装后 `--dump-config` | 通过：出现 `id: pseudo-insideout`、`name: dsh-pseudo-insideout`，临时 profile 的 `analyzeTurns:false` 覆盖生效 |
| `dsh --profile web --host 127.0.0.1 --port <临时端口> --no-open` | 通过：完整官方 Web 宿主成功启动，没有插件加载错误 |
| DSH 主页认证 | 通过：启动 URL 完成本机 token 交换后返回 HTTP 200；未认证主页为 401 |
| DSH boot graph | 通过：存在本插件 client 行和 settings 依赖 |
| DSH 自有 client module route | 通过：HTTP 200，实际返回 lazy-CJS 工厂，含 `settings.section` 注册与 iframe 组件 |
| `/pseudo-insideout/` | 通过：HTTP 200，HTML 正确注入 boot JSON 和 CSP nonce |
| `app.js` / `styles.css` | 通过：HTTP 200 与正确 MIME |
| 无 `X-InsideOut-Token` 的 `/state` | 通过：401，不公开记忆数据 |
| 有正确页面 token 的 `/state` | 通过：200，`mode=dsh`、`connected=false`，没有伪装已连接会话 |
| 手工创建临时测试记忆 | 通过：真实宿主 API 返回 201；内容明确标记仅作验收、不含用户资料 |
| 封存临时记忆 | 通过：200；活跃列表总数为 0，独立档案列表总数为 1 |

实际启动 URL 的鉴权 token 与插件 API token 均不写入本记录，不进入源码和交付包。

## 已完成的官方组件测试

`node --test test/dsh.test.js`：10/10 通过。使用实际官方 Cordis Context / fiber、DSH SystemPrompt、createScope 和 scopeTarget；agent registry、输入事件与 HTTP 注册器由测试夹具控制。

覆盖：成功回合去重、turn-stopping 不是最终提交、失败/中止回合不冒充成功、子 agent 排除、工作区与角色隔离、用户正文与 reasoning 分离、多次 prompt 读取无副作用、封存即清缓存、临时调阅只进入一轮的新上下文、卸载时取消辅助分析并落盘已完成回合原话、重启后浏览既有空间、loopback/Origin/Host/token 边界、浏览器模块工厂与 slot 注册。

## 限制与未验证项

- 尚未通过真实模型供应商完成会话往返；没有验证供应商的输出 JSON 合规率、成本或真实网络超时行为。
- 首次检查仅覆盖安装、boot graph 和模块资源；之后已使用独立 Playwright 浏览器确认真实设置页与 iframe 渲染，见下方补测。没有操作用户的 Chrome 窗口。
- DSH Desktop 原生壳、远程宿主及其他 DSH 版本均未验证。
- 封存只阻止新的日常召回；DSH 已有会话历史中的旧注入不由插件清除。

## 复现要点

在独立临时目录安装固定 DSH 包，设置专用 DSH_HOME 与 DSH_AGENTS_HOME，再创建 `web` profile；使用 `npm pack` 生成的本地 tgz 运行官方 `dsh plugin ... add`。指定 loopback 和不与已有服务冲突的临时端口，使用 `--no-open`。不需要模型密钥即可验证安装、Web 启动、模块加载清单和本插件手工 API。

## 独立浏览器补测（2026-10-30）

使用专用 Playwright Chrome 会话，载入临时宿主的认证状态，打开官方首页、Account menu → Settings → “记忆总部 · Pseudo Inside Out”。实际 iframe 渲染完整中文导航、真实数据范围和空库状态；创建了不发送模型消息的空会话后，显示 `DSH 会话已连接`。连接状态只表示存在宿主 agent，不表示已通过模型往返。

创建合成记忆的表单暴露了原 iframe `minHeight:760px` 超过设置容器的问题。现已改为容器内 `height:100%`、`minHeight:0`，诊断复测时 iframe 由 760px 收敛到 594px，创建按钮正常可点击。最终安装包将再次验证这条路径，结果保存在源码交付目录 `output/delivery/`；诊断时对页面样式的临时修改不算最终安装包验证。

截图：源码目录 `output/playwright/dsh-settings.png`。初次未认证访问的 401 和缺 favicon 的 404 均不作为插件运行成功证据；认证后的设置页和插件实际状态单独核对。

## 1.1 官方组件增补（2026-10-30）

`node --test test/dsh.test.js` 共 18 项通过，在原覆盖上增加了真实官方 `ToolsService` 和 `NativeToolExecutor`。新增验证包括：结构化记忆与待审提案、全部输入证据的真实版本、已知人格岛 ID 校验、关闭情绪仍可提炼、无效结果保留原话、每轮最多一次语义选择、修订竞争排除旧语义分数、日期范围、模型 usage 快照记账、超时与取消、每分钟维护以及卸载清理。只读工具通过官方注册器与执行器实际执行，不能读取档案、其他会话私有记忆或消费临时调阅授权。

辅助分析的正文只来自本轮用户原话和活跃可见记录。测试使用唯一标记证明：助手回复仍保存在原始记录，但不会传入辅助分析；人格岛的独立可修订正文也不会进入辅助输入，只保留 `{id,version,subject,evidenceIds}`。根层会再次验证依赖和版本，模型不能自行声明可信来源。

本节的官方组件测试仍由夹具控制事件，真实会话循环另由以下完整宿主验证覆盖。完整回归结果与最终安装包结果写入源码交付目录 `output/delivery/1.1.0/`，不把文档内固定哈希当作包身份。

## 1.1 完整宿主与本机合成提供商实测

已在新建的专用临时目录中，复用固定官方 DSH `0.2.2-alpha.2` runtime，安装 1.1.0 候选 tgz 并启动完整 Web profile。`DSH_HOME`、`DSH_AGENTS_HOME`、工作目录、会话和记忆均隔离；不读取用户供应商密钥或修改已有 profile。提供商仅监听 `127.0.0.1`，通过官方 `llm-pi-ai` 的 OpenAI Chat Completions 路由返回合成 SSE、工具调用和 usage。

测试驱动器调用官方 `agents.create`、`agent.followup` 和 `agent.whenIdle`；没有手动伪造 `session/event`。真实宿主负责消息持久化、模型请求、工具执行和 `turn/end`，插件监听该真实生命周期。

| 检查 | 候选包实测结果 |
| --- | --- |
| 官方 CLI 安装候选 tgz，完整 Web 宿主启动 | 通过 |
| 正常完成回合自动保存有来源的结构化记忆 | 通过：类型、重要度、原话与模型提炼方式可核对 |
| 下一真实回合的模型请求收到新召回 | 通过：请求含新增参考数据及真实记忆 ID |
| 同工作区两个会话的私有隔离 | 通过：B 的完整模型请求不含 A 的私有标记 |
| 模型请求 `insideout_search_memory` | 通过：经官方 NativeToolExecutor 返回活跃记忆 |
| 辅助提炼与语义召回的 token 用量 | 通过：从实际 SSE usage 回执记录，未用字符估算 |

复现工件位于源码的 `test/fixtures/verify-dsh-e2e.mjs` 与 `test/fixtures/dsh-e2e-driver.js`。默认新打候选包；传 `--tarball` 则安装指定包并核对已安装的宿主、核心、API 与网页资源字节。脚本始终新建隔离 profile，认证 URL 和测试令牌只留在该临时目录。测试工件不在 npm 运行包内。

```sh
node test/fixtures/verify-dsh-e2e.mjs \
  --runtime /absolute/path/to/isolated-dsh-runtime \
  --tarball /absolute/path/dsh-pseudo-insideout-1.1.0.tgz
```

`--runtime` 指向已有官方安装目录，其下应有 `node_modules/.bin/dsh`；不指定 `--keep` 时，验收结束关闭本轮宿主和合成提供商。最终冻结包须单独执行这条命令，不能把先前候选包结果视为最终包结果。机器可读结果位于源码的 `output/delivery/1.1.0/synthetic-host-e2e.json`，以其中包版本、来源、检查结果和外部交付清单为准；文档本身不嵌入最终包哈希，避免打包自引用。

### 1.1 的验证限制

- 本机合成响应验证了官方宿主与插件之间的工程链路，没有验证真实供应商的语义理解、JSON 合规率、实际计费、网络延迟或供应商取消行为。5 秒/15 秒超时和取消边界由受控组件测试覆盖。
- `analyzeTurns:false` 只关闭回合后的辅助提炼；1.1 默认开启的 `semanticEnabled` 仍可能触发轮前调用。关闭全部插件辅助调用需两个开关都关闭，具体见 [安装说明](06-installation.md)。1.0 历史记录中的“未调用模型”不代表这一个开关在 1.1 能关闭所有调用。
- 上述完整宿主驱动器选用官方 NativeToolExecutor；其他工具执行模式、DSH Desktop 原生壳、远程部署和其他 DSH 版本未作等价端到端验收。
- 定时器的触发和卸载已用受控时间验证；安静时段、到期判断和会话频率由核心回归覆盖，没有声称连续运行数天的可靠性实测。
- 封存阻止后续新增日常召回；已经写进 DSH 会话历史的旧上下文仍由宿主管理。合成测试不证明插件能够删除宿主历史。

## 1.2 默认策略与历史导入完整宿主验收

1.2 沿用上述官方 `0.2.2-alpha.2` runtime 和本机合成 SSE 提供商，每次运行仍创建新的隔离 `DSH_HOME`、工作目录和会话。扩展后的验收器已对 1.2.0 候选包完成 13 项检查；下表列出 1.2 新增覆盖，原有捕获、召回、会话隔离、官方工具执行和真实 usage 回执检查继续执行。

| 检查 | 完整宿主中的验证方式 |
| --- | --- |
| 单会话关闭 | API 设置为关闭后调用真实 `agent.followup`；回合正常完成，活跃记录数不增加，没有新增本插件 runtime context，也没有辅助模型请求 |
| 下一完整回合重开 | 设置会话为开启，下一真实回合再次注入原有记忆 ID 并捕获新回合 |
| profile 默认与跨工作区继承 | 关闭默认，在第二工作区创建新会话；该会话已注册且继承关闭，正常完成回合但不捕获、不注入、不辅助调用 |
| 会话显式覆盖 | 第二工作区的会话单独开启后可以捕获；两个空间读到的 profile 默认仍为关闭，原空间显式开启会话继续生效 |
| 宿主会话目录 | 在默认关闭状态下完成两轮真实会话、flush 并卸载 agent；通过 `ctx.sessionQuery` 所承载的导入目录找到该持久化根会话，搜索与分页有效，其他工作区会话不在目录中 |
| 预览、选择与幂等 | 两轮来源只勾选一轮；预览不写记忆，提交只产生所选记录，重复提交返回已存在而不复制，目标会话可见所选记录及准确来源 |
| 来源只读与本地提炼 | 提交前后通过公共 `readSession` 比较源快照摘要和事件数；源始终不在 live registry，未恢复或改写。导入期间无模型请求，情绪更新时间、待审提案数量和目标记忆开关不变 |
| 目标下一回合召回 | 目标真实会话下一回合新增的 runtime context 包含所选导入记忆 ID，未选正文没有注入 |

目录声明的是“当前宿主可见，并按当前工作区和角色筛选”，不声称宿主查询结果天然按 profile 过滤。上述测试的 DSH 事件由真实 agent loop 产生；驱动器没有伪造完成事件。为检查冷历史，测试驱动器新增受独立本机令牌保护的创建、卸载与只读检查入口，该文件不进入 npm 运行包。

```sh
node test/fixtures/verify-dsh-e2e.mjs \
  --runtime /absolute/path/to/isolated-dsh-runtime \
  --tarball /absolute/path/dsh-pseudo-insideout-1.2.0.tgz
```

验收器按传入包的 `package.json` 版本将结果写入 `output/delivery/<version>/synthetic-host-e2e.json`。报告记录实际安装包 SHA-256；`package.source=fresh-candidate-pack` 表示候选测试，`supplied-tarball` 表示指定包验收。安装后逐字节核对宿主适配器、导入适配器、策略、核心、导入器、API 与网页资源。最终交付应核对报告中的 SHA-256 与交付清单一致，候选结果不代替最终冻结包验收。

此处仍只验证官方宿主工程链路与合成供应商回执，不证明真实供应商质量、Desktop 原生壳或长期运行可靠性。关闭记忆约束本插件此后新增的捕获、辅助调用和注入，不删除宿主历史中已有的旧文本。同轮策略变更、异步竞争和来源变化拒绝另由组件及核心测试覆盖。

## 宿主版本矩阵（2026-10-31）

本次以同一份 `0.0.1` 候选包，在 macOS arm64、Node.js `v26.13.0` 上逐一安装各版本官方 DSH，使用全新隔离 profile 与本机合成 SSE 提供商执行完整宿主验收。以下结果为本次执行，不沿用历史 1.0–1.2 工件。

| DSH Web 版本 | 完整宿主结果 | 工具执行方式 |
|---|---|---|
| `0.2.1-rc.1` | 13/13 通过 | 宿主内置原生工具管线 |
| `0.2.1-rc.2` | 13/13 通过 | 宿主内置原生工具管线 |
| `0.2.1-rc.3` | 13/13 通过 | 宿主内置原生工具管线 |
| `0.2.1-rc.4` | 13/13 通过 | 宿主内置原生工具管线 |
| `0.2.1-rc.5` | 13/13 通过 | 宿主内置原生工具管线 |
| `0.2.2-alpha.2` | 13/13 通过 | 官方 `NativeToolExecutor` |

每个版本均覆盖 CLI 安装、Web 启动、真实回合的结构化提炼与下一轮召回、会话隔离、原生记忆检索工具、实际 SSE usage、全局与会话开关、跨工作区默认继承、冷历史目录、只读预览与选择性导入、幂等提交和导入后的召回。源码 `npm test` 为 **103/103 通过**；新增三项回归覆盖旧版模型切换、跨会话路由隔离、无有效模型时的回退边界，以及新版接口优先级。

旧宿主没有 `agent.model.current()`：语义检索读取本次 scoped prompt assembly 的最终模型变量。没有选择变量时，只有初始模型选项与历史请求配置不冲突才调用辅助模型；例如恢复会话时两者冲突，则先回退本地检索，避免调用旧供应商。回合提炼读取完成请求的模型配置。现代宿主继续使用自己的模型选择 API。两条路径均保留原有开关、取消和来源校验。

兼容声明为 `>=0.2.1-rc.1 <=0.2.1-rc.5 || 0.2.2-alpha.2`。已按官方插件管理器使用的 `includePrerelease:true` 规则检查边界；`rc.6`、`0.2.1` 正式版、其他 `0.2.2` alpha 与正式版均不自动纳入范围。Node.js 最低要求仍为 `24.9.0`，本次未新增 Node 版本矩阵。

重现某个版本的宿主验收（在仓库根目录执行）：

```sh
npm install --prefix output/compatibility/runtime-0.2.1-rc.5 \
  --ignore-scripts --no-audit --no-fund --save-exact @deepseek-ai/dsh@0.2.1-rc.5
node test/fixtures/verify-dsh-e2e.mjs \
  --runtime output/compatibility/runtime-0.2.1-rc.5
```

将路径与包版本一起替换即可测试表中其他版本。验收器现在从 CLI 读取真实 DSH 版本并记录 Node 版本，驱动器只使用所选 runtime 的组件；默认报告路径为 `output/delivery/<插件版本>/dsh-<宿主版本>/synthetic-host-e2e.json`，也可用 `--output <报告目录>` 指定。省略 `--tarball` 时自动打候选包；指定最终包验收时仍传 `--tarball /absolute/path/final.tgz`。

本次六份报告记录同一候选包 SHA-256，汇总在本地 `output/compatibility/matrix.json`，源码测试日志为 `output/compatibility/tests.log`。验证后补充的文档不在该候选工件内；后续重新打包应以新 SHA-256 区分。报告与 runtime 不随源码或 npm 包分发。浏览器外观、Desktop 原生壳、其他操作系统、真实商业供应商及长期运行没有在本次矩阵中重新验证。
