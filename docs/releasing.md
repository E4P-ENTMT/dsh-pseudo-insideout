# GitHub 发布维护

[项目首页](../README.md) · [安装指南](../INSTALL.md) · [更新记录](../CHANGELOG.md)

安装用户从 [GitHub Releases](https://github.com/E4P-ENTMT/dsh-pseudo-insideout/releases) 获取 `.tgz`，不需要开发依赖。当前没有 npm 发布流程。

## 发布一个版本

1. 更新 `package.json` 和 `package-lock.json` 的版本；同步 `INSTALL.md`、README 的版本链接，在 `CHANGELOG.md` 添加对应版本条目。
2. 执行 `npm ci --ignore-scripts`、`npm test`、`npm run release:pack`，核对 `output/release/` 中的 `.tgz`、`INSTALL.md`、`SHA256SUMS`。该脚本检查运行资源和包内文件范围，不打入测试、日志或用户数据库。
3. 完成目标 DSH 版本及界面的验证，记录实际工件与未测范围；打包后改变运行文件必须重新验证。
4. 提交并推送分支，等待 CI 通过，再创建与包版本一致的附注标签，例如：

```sh
git tag -a v0.0.1 -m "🚀 chore(release): publish v0.0.1"
git push origin v0.0.1
```

`Release` 工作流先执行两版 Node 的测试和打包检查，再用 Node 24.9.0 生成安装资产，将**同一份 tarball**安装到独立的 DSH `0.2.2-rc.1` Web profile，完成本机合成模型流程。全部通过后创建 Release 草稿、上传三个附件并发布为最新版本。它不调用真实模型、不使用用户 DSH profile、不发布 npm，也不会替换已有 Release。

发布使用 GitHub 内置 `GITHUB_TOKEN` 的仓库内容写权限，无需额外的 npm Token。第三方 Actions 固定到官方提交 SHA。发布日志中的包 SHA-256 可与 Release 附件清单核对。

## 发布后核对

- Tag 指向预期提交，版本与包 manifest 一致。
- Release 为非草稿，包含 `.tgz`、`INSTALL.md`、`SHA256SUMS`。
- 从公开下载地址重新下载并核对 SHA-256，再用隔离 profile 验证安装入口。
- README 的下载和安装地址可直接使用。

已发布 Tag 和安装资产不应原地替换；后续修复使用新版本。若工作流在上传草稿后中断，先检查草稿与已上传资产，再决定继续发布或处理失败，不将不完整发布标为成功。
