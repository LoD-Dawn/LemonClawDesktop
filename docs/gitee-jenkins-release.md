# Gitee main 自动打包与 Release

这个方案针对当前仓库，目标是：

- 每次合并到 `main` 后自动触发
- Windows 节点构建 `npm run dist:win`
- macOS 节点构建 `npm run dist:mac:universal`
- 自动生成 changelog
- 自动创建或更新 Gitee Release
- 自动上传 `release/` 下的安装包

## 已提供的文件

- [Jenkinsfile](/C:/Users/Administrator/Desktop/project/lemonClaw/lemon-claw-desktop/Jenkinsfile)
- [scripts/generate-gitee-changelog.cjs](/C:/Users/Administrator/Desktop/project/lemonClaw/lemon-claw-desktop/scripts/generate-gitee-changelog.cjs)
- [scripts/create-gitee-release.cjs](/C:/Users/Administrator/Desktop/project/lemonClaw/lemon-claw-desktop/scripts/create-gitee-release.cjs)

## 流水线行为

`Jenkinsfile` 当前固定做三件事：

1. `windows` 节点执行 `npm ci` 和 `npm run dist:win`
2. `macos` 节点执行 `npm ci` 和 `npm run dist:mac:universal`
3. `linux` 节点生成 changelog，并调用 Gitee OpenAPI 发布 release

release tag 默认格式为：

```text
main-<package-version>+build.<jenkins-build-number>.<short-sha>
```

例如：

```text
main-0.2.3+build.128.a1b2c3d
```

这样可以保证每次合并到 `main` 都有唯一 tag，不会和正式版本号冲突。

## Jenkins 节点要求

需要至少 3 个 agent：

- `windows`
- `macos`
- `linux`

其中：

- `windows` 节点需要 Node.js 24 和本仓库 Windows 打包依赖
- `macos` 节点需要 Node.js 24、Xcode Command Line Tools、Apple 开发者签名环境
- `linux` 节点只负责生成 changelog 和调用 Gitee API，也需要安装 Node.js 24

如果你没有 Linux 节点，也可以把 `Publish Release` 改到 `macos` 节点执行。

当前 `Jenkinsfile` 已经参数化了节点标签：

- `WINDOWS_LABEL`
- `MACOS_LABEL`
- `PUBLISH_LABEL`

默认值分别是：

- `windows`
- `macos`
- `linux`

如果你的 Jenkins 实际标签是 `win-builder`、`mac-mini`、`release-node`，直接在 Jenkins 构建参数里覆盖即可，不需要改脚本逻辑。

## Jenkins 凭据

需要增加一个 Jenkins Secret Text：

- `gitee-token`

这个 token 需要有目标 Gitee 仓库的 release 发布权限。

当前 `Jenkinsfile` 也把凭据 ID 参数化了：

- `GITEE_TOKEN_CREDENTIALS_ID`

默认值是 `gitee-token`。  
如果你们 Jenkins 里实际叫 `gitee-release-token`，把这个参数改成对应值即可。

## macOS 签名与公证

当前仓库会在 macOS 打包后执行公证逻辑，见：

- [electron-builder.json](/C:/Users/Administrator/Desktop/project/lemonClaw/lemon-claw-desktop/electron-builder.json#L78)
- [scripts/notarize.js](/C:/Users/Administrator/Desktop/project/lemonClaw/lemon-claw-desktop/scripts/notarize.js#L14)

macOS 节点至少需要这些环境变量：

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

如果还要做正式代码签名，通常还要额外配置：

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

如果这些变量没配，仓库里的脚本会跳过 notarize，包仍可能打出来，但终端用户安装时会看到更严格的系统安全提示。

## Gitee WebHook 配置

推荐配置方式：

1. 在 Jenkins 新建一个 Pipeline 项目，直接读取仓库根目录的 `Jenkinsfile`
2. 在 Jenkins 里配置仓库凭据和 `gitee-token`
3. 在 Gitee 仓库里添加 WebHook
4. 事件选择 `Push`
5. 只让 `main` 分支的更新触发 Jenkins

你要的“每次合并到 main 自动触发”，本质上就是：

- PR/MR 合并后，`main` 收到一次新的 push
- Gitee 把 push 事件发给 Jenkins
- Jenkins 跑 `Jenkinsfile`

## 本仓库新增 npm 命令

```bash
npm run release:changelog
npm run release:gitee
```

说明：

- `release:changelog` 会从最近一个 tag 到当前提交生成 markdown changelog
- `release:gitee` 会创建或更新对应 tag 的 Gitee Release，并上传构建产物

## 关于 tag 的一个兼容性说明

当前脚本默认依赖 Gitee Release API 使用 `tag_name + target_commitish` 创建新 release。  
大多数公有 Gitee 仓库可以直接这样工作。

如果你的 Gitee 私有化环境或企业实例要求“tag 必须预先存在”，就在 `Publish Release` 阶段前增加一段：

```bash
git tag -f "$RELEASE_TAG" "$RELEASE_TARGET"
git push origin "refs/tags/$RELEASE_TAG" --force
```

前提是 Jenkins 使用的仓库凭据具有推 tag 权限。

## 本地手工验证示例

只验证 changelog：

```bash
node scripts/generate-gitee-changelog.cjs --output CHANGELOG.auto.md
```

手工发布到 Gitee：

```bash
set GITEE_OWNER=omini_1
set GITEE_REPO=lemon-claw-desktop
set GITEE_TOKEN=your_token
set RELEASE_TAG=main-0.2.3+build.test.local
set RELEASE_TARGET=main
node scripts/create-gitee-release.cjs --body-file CHANGELOG.auto.md --release-dir release
```

PowerShell 下可写成：

```powershell
$env:GITEE_OWNER='omini_1'
$env:GITEE_REPO='lemon-claw-desktop'
$env:GITEE_TOKEN='your_token'
$env:RELEASE_TAG='main-0.2.3+build.test.local'
$env:RELEASE_TARGET='main'
node .\scripts\create-gitee-release.cjs --body-file CHANGELOG.auto.md --release-dir release
```

## 一个现实约束

mac 安装包的“正式可分发版本”必须在 macOS 机器上构建和签名。  
这也是为什么有些 GitHub 仓库能自动出 mac 包，因为它们用的是 GitHub 提供的 `macOS runner`。  
如果你在 Gitee 体系里做这件事，必须自己准备一台 mac 构建机，或者让 Jenkins 接到一台 `macos` agent。
