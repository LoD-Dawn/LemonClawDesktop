# GitHub 构建 + 本地发布到 Gitee

推荐给当前仓库的最简单方案：

- Gitee 作为主仓库
- GitHub Actions 只负责构建 Windows 和 macOS 包
- 你本地手动把构建产物发布到 Gitee Release

## 当前仓库提供的命令

```bash
npm run release:changelog
npm run release:gitee
npm run release:local
```

其中最推荐直接用：

```bash
npm run release:local -- --artifacts-dir artifacts
```

## 第一步：推代码

日常开发完成后：

```bash
git add .
git commit -m "你的提交说明"
git push origin main
git push github main
```

说明：

- `origin` 是 Gitee
- `github` 是 GitHub 镜像仓库

## 第二步：等 GitHub 构建完成

打开 GitHub 仓库的 `Actions` 页面，确认这两个任务成功：

- `Build Windows`
- `Build macOS`

## 第三步：下载构建产物

在这次 workflow 详情页底部下载 artifacts：

- `release-win`
- `release-mac`

下载后在本地项目根目录解压成这样：

```text
artifacts/
  win/
    ...
  mac/
    ...
```

只要 `artifacts/win` 和 `artifacts/mac` 里能看到安装包文件就可以。

## 第四步：配置 Gitee token

Windows PowerShell：

```powershell
$env:GITEE_OWNER='omini_1'
$env:GITEE_REPO='lemon-claw-desktop'
$env:GITEE_TOKEN='你的GiteeToken'
```

如果你的 Gitee 仓库 owner 或 repo 名不同，改成你自己的。

## 第五步：本地发布测试版

最简单的命令：

```powershell
npm run release:local -- --artifacts-dir artifacts
```

这会自动做三件事：

1. 生成 `CHANGELOG.auto.md`
2. 创建一个类似 `main-0.2.3-local-20260328153000` 的 prerelease tag
3. 上传 `artifacts/` 里的安装包到 Gitee Release

## 第六步：本地发布正式版

如果你要发正式版，例如 `v0.2.4`：

```powershell
npm run release:local -- --artifacts-dir artifacts --prerelease false --tag v0.2.4 --name "LemonClaw v0.2.4"
```

## GitHub workflow 当前行为

当前 workflow 只做：

- Windows 打包
- macOS 打包
- 上传 artifacts

它不会再直接调用 Gitee API。
