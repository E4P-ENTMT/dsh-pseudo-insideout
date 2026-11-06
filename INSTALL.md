# 安装 dsh-pseudo-insideout 0.0.1

这是 DeepSeek Harness（DSH）的记忆插件。安装包已包含可运行代码，无需克隆仓库、编译或安装开发依赖。当前通过 GitHub Release 分发，尚未发布到 npm。

## 下载

- [安装包 dsh-pseudo-insideout-0.0.1.tgz](https://github.com/E4P-ENTMT/dsh-pseudo-insideout/releases/download/v0.0.1/dsh-pseudo-insideout-0.0.1.tgz)
- [SHA-256 校验清单](https://github.com/E4P-ENTMT/dsh-pseudo-insideout/releases/download/v0.0.1/SHA256SUMS)
- [版本说明与全部附件](https://github.com/E4P-ENTMT/dsh-pseudo-insideout/releases/tag/v0.0.1)

安装请选择上面的 `.tgz` 附件；GitHub 自动生成的 `Source code (zip)` / `Source code (tar.gz)` 是开发源码快照。

## 支持环境

- Web：Node.js **≥24.9.0**；DSH **0.2.1-rc.1 至 0.2.1-rc.5、0.2.2-alpha.2、0.2.2-alpha.3、0.2.2-rc.1**。
- Desktop：已实测 **macOS arm64 / DSH 0.2.2-rc.1**，使用桌面应用自带的运行环境。
- 控制台仅供本机访问。其他 DSH 版本和桌面平台尚未获得相同验证。

## Desktop：粘贴地址安装

1. 打开 DSH → **插件** → **添加插件**。
2. 粘贴下方完整地址，点击 **安装**，完成后点击 **立即启用**。
3. 点击主窗口侧栏 **记忆总部**，开始使用。

```text
https://github.com/E4P-ENTMT/dsh-pseudo-insideout/releases/download/v0.0.1/dsh-pseudo-insideout-0.0.1.tgz
```

如果下载受网络影响，先用浏览器下载 `.tgz`，在「添加插件」中填写下载文件的**绝对路径**。安装包无需解压。

## Web：一条命令安装

以下以 `web` 为 profile 名；使用其他 profile 时替换它：

```sh
dsh plugin --profile web add https://github.com/E4P-ENTMT/dsh-pseudo-insideout/releases/download/v0.0.1/dsh-pseudo-insideout-0.0.1.tgz
```

安装后重新启动对应 profile：

```sh
dsh --profile web
```

也可安装已下载的文件：

```sh
dsh plugin --profile web add /absolute/path/dsh-pseudo-insideout-0.0.1.tgz
```

## 可选：核对下载

将 `.tgz`、`INSTALL.md` 和 `SHA256SUMS` 三个附件保存到同一目录，在该目录运行：

```sh
# macOS
shasum -a 256 -c SHA256SUMS
# Linux
sha256sum -c SHA256SUMS
```

两项均应显示 `OK`。Windows 可使用 `Get-FileHash .\dsh-pseudo-insideout-0.0.1.tgz -Algorithm SHA256`，与清单中的相应值比较。

## 第一次使用与升级

打开 DSH 主会话，完成一轮对话，再到「记忆总部 → 记忆大厅」查看记录。同一工作区、同一角色的新会话默认可召回共享记忆；跨空间使用需在「记忆与共享」中开启可选的全局记忆。右上角「主题」可选择五套配色或跟随系统。

辅助提炼复用 DSH 当前模型，可能产生额外调用费用；在「运行与设置」关闭「允许辅助模型调用」可仅使用本地捕获与检索。

升级前停止对应插件或宿主，备份完整的插件 profile 数据目录；替换插件不会删除已保存的记忆。本版会迁移符合条件的旧自动记忆为跨会话可用，手动私有、封存和依赖私有证据的记录仍保留原边界。详见[安装维护与备份](https://github.com/E4P-ENTMT/dsh-pseudo-insideout/blob/v0.0.1/docs/06-installation.md)和[完整使用指南](https://github.com/E4P-ENTMT/dsh-pseudo-insideout/blob/v0.0.1/docs/usage.md)。
