# DSH 宿主契约调研

调研时间：2026-10-29（Asia/Shanghai）。本文只把已经读取的官方源码当作接口依据；第三方插件只作实现参照。没有运行远端仓库脚本，也没有安装到用户的 DSH。

## 版本基线与证据状态

已确认：官方仓库 `deepseek-ai/deepseek-harness` 在调研时的 master 是 `f3803c96974ad4a94195fb97e5c637e9c2a3afe3`；根 `package.json` 的版本为 `0.2.2-alpha.2`，Node 要求 `>=24.9.0`。

- [固定版本 package.json](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/package.json)
- [npm DSH 元数据](https://registry.npmjs.org/@deepseek-ai/dsh)：调研时 `latest=0.2.1-rc.2`，`next=0.2.1-rc.4`，`alpha=0.2.2-alpha.2`。主分支、latest、next 不是同一个版本，不能用“最新版”代替兼容性说明。
- 本机可执行 Node `v26.13.0`，没有 `dsh` 命令。单元测试、HTTP 实测、浏览器测试和官方契约检查可执行；真实宿主验收需要隔离安装宿主或另行在用户已安装的宿主中验收。

本文的接口确认以以上固定 SHA 为准；低版本兼容性必须另测，不能从同名 API 推断。

## 1. 可安装插件结构

已确认：DSH 插件是 Cordis 模块，支持 `export const name`、`export const inject`、`export function apply(ctx, config)`。事件、effects、工具等必须通过插件上下文绑定生命周期。`inject` 声明宿主服务依赖。

可分发 npm bundle 需要：

```text
dsh-pseudo-insideout/
  package.json            # name/type=module/exports/files/dsh.bundle
  cordis.patch.yml        # 插入宿主插件行
  src/dsh/host.js         # apply 等宿主导出
  src/dsh/client.js       # 浏览器模块工厂注册脚本
  src/core/...            # 记忆业务实现
  web/...                 # 控制台静态资源
```

`package.json` 的 `dsh.bundle.patch` 指向 `./cordis.patch.yml`，patch 内容为：

```yaml
- insert:
    - id: pseudo-insideout
      name: dsh-pseudo-insideout
```

`dsh plugin --profile <name> add <本地目录或tgz>` 安装 bundle 并维护 profile 的 bundle 列表。没有 `dsh.bundle` 的 npm 包只被作为依赖，不会激活。使用 `engines.dsh` 明确兼容范围；不支持的版本可能在安装/启动被拒绝。交付已经可运行的 JavaScript 和 tarball 无需安装期间构建脚本。

依据：[首个插件](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/user/develop/basic/index.zh.md)、[打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/user/develop/basic/publish.zh.md)。

## 2. 浏览器半端与控制台入口

已确认：宿主根据激活 Loader 根行（包的裸名）识别 `dsh.client`，加载 `exports["./client"]`；子路径插件行不携带浏览器半端。浏览器入口不能是未经转换的普通 ESM，应注册 lazy-CJS 工厂：

```js
window.__ModuleLoader__.load({
  id: 'dsh-pseudo-insideout',
  factory(require) {
    const React = require('react')
    return {
      inject: ['slots'],
      apply(ctx) {
        // 使用 slots.inject 注册，卸载时由生命周期清理。
      }
    }
  }
})
```

通过 `ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section', id, order, label}, Component))` 可以注册设置入口，组件可展示同源 iframe 控制台。`dsh.client.platform='web'`；client manifest 的 inject 用于客户端插件启动，工厂内 inject 声明服务。基线共享 React 可通过 require 取得，无需重复打包 React。

可实现方案：宿主 `/pseudo-insideout/` 提供 HTML，浏览器半端提供“总部控制台”入口；保留可单独打开的同源 URL。iframe 与 API 都由同一宿主承担。这里选择 iframe 是工程方案，非官方要求。

依据：[客户端模块系统](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/client/modules/README.md)、[设置页 cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/cookbook/adding-a-settings-card.md)、[官方 slot 注册用例](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/client/ui-settings-plugins/src/client/index.ts)。

## 3. Agent 生命周期、输入与完整回合

已确认的事件：

| 事件 | 签名/语义 | 适配层用途 |
| --- | --- | --- |
| `agent/created` | `{agent, source, signal?}`；serial，创建完成前等待 | 新 agent 挂载 scoped prompt 与监听 |
| `agent/disposed` | `{agent}` | 清理会话缓存和后台任务 |
| `agent/inbox/inserted` | `{agent,message}` | 只能作为候选输入，可能排队、撤回，不代表已发生完整回合 |
| `agent/pre-step` | `(payload,next)`；waterfall；payload 含 `agent,messages,turn,step,signal,modelSelection` | 用本次真正拟进入 step 的消息做查询，准备召回快照，并返回 `next()` |
| `agent/turn-stopping` | `{agent,turn,signal}`；serial | 尚未提交结束，后续 steering 可继续；不能据此认定完整回合 |
| `session/event` | `(session,event)`；post-commit 只读通知 | 收集 `user/message`、`assistant/message`，并在成功 `turn/end` 写入经历 |

`event.type='turn/end'` 的 `event.data={turn,reason}`。只有 `reason.kind==='completed'` 算本实现的自动捕获成功回合；aborted/error/max-tokens/blocked 不能冒充成功。`assistant/message` 的正文在 `event.data.message.content`，`user/message` 的正文在 `event.data.content`；保留 source.kind，过滤宿主上下文和插件自己注入的文本。只提取 text 部分，不保存 reasoning。

去重键必须包含 sessionId 与 turn；如果用完整业务 scope 再加该键，则并发重入和重复通知不会生成两颗记忆球。

`session.snapshotEvents()`、`eventAt()` 在当前官方代码中已标记 deprecated，新代码不应照抄第三方插件继续扫描全历史。应使用 `session/event` 增量观察；对插件启动之前的既有历史明确不自动回填。

依据：[Agent events](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/agent/src/runtime-types.ts)、[Session events](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/session/src/index.ts)、[会话事件形状](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/session/src/types.ts)、[turn stop 与真正提交的先后](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/agent-loop/src/agent.ts)。

## 4. Prompt 注入与临时调阅边界

已确认：`agent.ctx.systemPrompt.context({name,order,text,interpolate:false})` 注册 scoped runtime context。`text` provider 是同步函数；不能返回 Promise。调用方应先完成异步/SQLite 查询，再由 provider 只读不可变文本缓存。

宿主在 `pre-step` 之前 assemble，但在 pre-step 和路由准备之后再次 `refreshContext`，因此 pre-step 更新缓存会在 admission 前被重读。provider 可能在一个 step 被调用多次；禁止在 provider 中消费授权、写召回统计、重复执行副作用。

**runtime context 会成为 model history 中带来源的 user-role snapshot。**所以封存的严格保证是“今后日常检索不访问档案库、不重新注入”，并不意味抹除它曾经出现过的会话历史。临时调阅同理，只保证一轮/一次任务的新增注入范围，不声称清除宿主历史。设置 `interpolate:false` 保留记忆中 `{{...}}` 字面文本，防止把原文误作宿主模板变量。

依据：[system-prompt 文档](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/system-prompt/README.md)、[同步 provider 类型](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/system-prompt/src/index.ts)。

## 5. 数据隔离与宿主事实

已确认：`ctx.profileContext` 由 profile launcher 提供，含 `name,dir,home,cwd`。不在 profile 启动的组合可能没有该服务；应要求显式配置 profile 身份或禁用，不能悄悄退回某个全局 default 导致串库。

`agent.session.id` 是会话身份；`session.header.cwd` 是创建时工作目录；`session.header.agentPreset` 是预设身份；`header.origin==='subagent'` 是官方子 agent 分类。`ctx.agents.roots()` 可取当前根 agent，但 origin 的历史语义仍应按 header 判断。默认隔离维度可为 profile 目录、agent preset（缺省明确为 default）、workspace 规范路径、session ID；跨 session workspace 共享必须由用户显式选用。DSH 当前会话身份不等于可自行假设的长期人格身份。

依据：[ProfileContext](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/boot/app-boot/src/profile-context.ts)、[SessionHeader](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/session/src/types.ts)、[Agent registry](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/agent/src/index.ts)。

## 6. HTTP 服务与访问控制

已确认：`ctx.webServer.register({kind:'exact'|'prefix',path,handler(req,res)})` 返回 disposer。底层是 Node IncomingMessage / ServerResponse，handler 拥有响应生命周期。

**官方文档明确说明 webServer 不提供全局认证或 Origin 策略。**不能因为路由挂在 DSH 上就认为它已继承 DSH API 登录权限。工程方案：第一版控制台仅允许 loopback 客户端，校验 Host、防 DNS rebinding、拒绝跨站请求，并使用页面下发的随机 session token 验证所有数据 API；不设置宽松 CORS。不把 token 放 URL、日志或浏览器 localStorage。远程部署在接入正式 DSH 认证/Peer 前拒绝访问，而不是降低保护。

HTML boot 占位符为 `__INSIDEOUT_BOOT__`，仅替换为转义后的 `{apiBase,token,mode}` JSON。静态文件白名单/真实路径约束，API request body 限制，路径不参与任意磁盘文件读取。

依据：[webserver README](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/host/webserver/README.md)、[路由类型](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/host/webserver/src/index.ts)。

## 7. 模型调用

已确认：`ctx.llm.stream({provider,model,system,messages,signal,sessionId,maxTokens,temperature})` 返回 async iterable，text-delta.text 为正文分片。`agent.model.current()` 返回当前 provider/model 选择；可用它做可选语义提炼/情绪判断，不直接读取密钥。必须明确这会产生额外模型调用与费用，设置可关闭。

模型结果只是待验证 JSON：尺寸、字段、取值、引用 ID 均需校验；失败保留原始经历，不把模型输出当系统指令，不覆盖原始记录。正文与 reasoning 分离，只处理 text-delta。

依据：[LLM GenerateOptions](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/llm/llm/src/types.ts)、[Agent Model API](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/agent/src/runtime-types.ts)。

## 8. 第三方参照与不继承的假设

- `dsh-fish-memory` 固定 SHA `2bb9be7b83bac5e69737a457873027c3933e12cc`，package version `1.4.3`。确有 bundle patch、host/client 双端、prompt context、会话事件和检索 UI。[仓库](https://github.com/Yuuyuko-uu/dsh-fish-memory/tree/2bb9be7b83bac5e69737a457873027c3933e12cc)
- `dsh-feiyu-mood` 固定 SHA `f5459025a4d83298c57a1fc64eefa9ece5f91214`，package version `0.8.0`。确有 session/工作区绑定、LLM 情绪判断、settings.section、webServer 路由。[仓库](https://github.com/Yuuyuko-uu/dsh-feiyu-mood/tree/f5459025a4d83298c57a1fc64eefa9ece5f91214)
- 不复用它们的人格价值规则、全局固定目录、轮询挂钩、全历史同步扫描或对未知输入来源的信任策略。第三方文档的“最新版适配”不是本插件的兼容证明。

## 9. 计划验证

1. `node --test`：fake Cordis 生命周期、真实形状 event feed、pre-step/context 多次调用、失败回合不入库、子 agent 跳过、profile/workspace/session 隔离、dispose 清理。
2. HTTP 实测：正常页面/token、缺 token、跨 Origin、错误 Host、非 loopback、body 超限、静态穿越、卸载后路由清理。
3. client 工厂在 VM 加载，断言 package id、slot 注册与清理；浏览器中真实展示全部业务页。
4. `npm pack --dry-run` 与 tgz 解包检查，所有 entry/export/files 路径存在，安装不要求 prepare 脚本。
5. 如果能在隔离目录安装固定 DSH 版本，运行真实 Cordis 宿主最小集成；否则明确“契约测试通过，真实 DSH 运行待验”，不得宣称已经实装成功。
