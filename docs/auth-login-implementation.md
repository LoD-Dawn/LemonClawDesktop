# 管理端账号登入认证 — 实现文档

> **日期**：2026-03-11  
> **功能**：桌面端通过 `diclaw://` 自定义协议对接管理端账号体系，实现 SSO 登录、Token 校验、账号禁用提示

---

## 一、功能概述

### 登录流程

```
桌面端启动
  │
  ├─ 从本地读取加密 Token
  │     ├─ 无 Token → 显示【登录页】
  │     └─ 有 Token → 调管理端 /api/desktop/auth/verify
  │                     ├─ 有效     → 正常进入主界面 ✅
  │                     ├─ 已禁用   → 显示「账号已被管理员停用」提示页 🚫
  │                     └─ 已过期/网络错误 → 回到登录页 🔑
  │
  └─ 登录页：用户点击「前往管理端登录」
               │
               ├─ 打开管理端登录 URL（外部浏览器）
               ├─ 用户完成登录
               └─ 管理端重定向到 diclaw://auth?token=xxx
                     │
                     └─ 主进程捕获 → 校验 Token → 保存 → 通知渲染进程 → 进入主界面
```

### 触发校验时机

| 时机 | 行为 |
|------|------|
| **每次启动** | 强制联网校验，失败则显示登录页 |
| **管理端禁用账号** | 下次启动时感知（启动时校验） |
| **离线状态** | 不允许离线使用，直接跳转登录页 |

---

## 二、文件改动清单

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `src/main/authStore.ts` | 主进程 — AES-256-GCM 加密 Token 存取，密钥与机器 userData 路径绑定 |
| `src/renderer/types/auth.ts` | 渲染层认证类型定义（`AuthUser`、`AuthStatus`、`AuthVerifyResult` 等） |
| `src/renderer/store/slices/authSlice.ts` | Redux auth slice（`checking` / `logged_out` / `disabled` / `logged_in`） |
| `src/renderer/components/auth/LoginScreen.tsx` | 登录页 UI（点击跳转管理端，等待深链接回调） |
| `src/renderer/components/auth/DisabledScreen.tsx` | 账号被禁用提示页 UI |

### 修改文件

| 文件路径 | 改动说明 |
|---------|---------|
| `src/main/main.ts` | 注册 `diclaw://` 协议；`second-instance` 捕获 Windows 深链接；`open-url` 捕获 macOS 深链接；4 个 auth IPC handlers |
| `src/main/preload.ts` | 暴露 `window.electron.auth` 命名空间 |
| `src/renderer/types/electron.d.ts` | 新增全局 `AuthUser`、`AuthVerifyResult` 类型；`IElectronAPI.auth` 接口定义 |
| `src/renderer/store/index.ts` | 注册 `authReducer` |
| `src/renderer/services/endpoints.ts` | 新增管理端 API 地址配置（`getAdminApiBase`、`getAdminVerifyUrl`、`getAdminLoginUrl`） |
| `src/renderer/App.tsx` | 启动时优先校验 Token；条件渲染登录页 / 禁用页 / 主界面；登出 / 切换账号处理 |
| `electron-builder.json` | macOS `CFBundleURLTypes`；Windows `protocols` — 注册 `diclaw://` 协议 |

---

## 三、各文件关键代码说明

### 3.1 `authStore.ts` — Token 加密存储

```typescript
// 密钥使用 userData 路径做盐，与机器绑定
const seed = 'diosclaw-auth-v1';
const salt = app.getPath('userData');
this.encKey = crypto.scryptSync(seed, salt, 32);

// AES-256-GCM 加密：iv(16B) + tag(16B) + ciphertext
// 存到 SQLite kv 表的 "auth.state" key 下
```

**安全特性**：
- 加密密钥与本机 `userData` 路径绑定，数据库文件复制到其他机器无法解密
- 使用 AES-256-GCM（认证加密），自带完整性校验
- 登出时直接删除 kv 条目

---

### 3.2 `main.ts` — 深链接注册与处理

**协议注册**（在 `app.ready` 前后分别处理 Windows/macOS）：

```typescript
// Windows / Linux（ready 之前）
if (process.platform !== 'darwin') {
  app.setAsDefaultProtocolClient('diclaw');
}

// macOS（ready 之后）
app.on('ready', () => {
  if (process.platform === 'darwin') {
    app.setAsDefaultProtocolClient('diclaw');
  }
});
```

**Windows 深链接捕获**（`second-instance` 事件）：

```typescript
app.on('second-instance', (_event, commandLine) => {
  const deepLinkUrl = commandLine.find(arg => arg.startsWith('diclaw://'));
  if (deepLinkUrl && deepLinkUrl.startsWith('diclaw://auth')) {
    void handleAuthDeepLink(deepLinkUrl);
  }
});
```

**macOS 深链接捕获**（`open-url` 事件）：

```typescript
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('diclaw://auth')) {
    void handleAuthDeepLink(url);
  }
});
```

**深链接处理流程**（`handleAuthDeepLink`）：

1. 从 URL 解析 `token` 参数
2. 调管理端 `/api/desktop/auth/verify` 联网校验
3. 成功 → `authStore.save(token, user)` → `win.webContents.send('auth:loginSuccess', user)`
4. 403 禁用 → `win.webContents.send('auth:loginError', '账号已被管理员禁用')`
5. 网络失败 → `win.webContents.send('auth:loginError', '网络连接失败...')`

---

### 3.3 `authSlice.ts` — Redux 认证状态

```typescript
type AuthStatus = 'checking' | 'logged_out' | 'disabled' | 'logged_in';

// Actions:
// setAuthChecking()   — 初始检查中
// setAuthLoggedIn(user) — 校验通过
// setAuthLoggedOut()  — 无 token 或已过期
// setAuthDisabled()   — 账号被禁用
```

---

### 3.4 `App.tsx` — 认证前置检查 & 条件渲染

**启动时认证前置检查**（在所有其他初始化之前）：

```typescript
// initializeApp() 最开头：
const verifyResult = await window.electron.auth.verify();
if (!verifyResult.valid) {
  if (verifyResult.reason === 'disabled') {
    dispatch(setAuthDisabled());
  } else {
    dispatch(setAuthLoggedOut());
  }
  setIsInitialized(true);
  return; // 停止后续初始化
}
dispatch(setAuthLoggedIn(verifyResult.user!));
// 认证通过 → 继续 configService.init() 等流程
```

**渲染条件分叉**（加载完成后）：

```tsx
if (authStatus === 'logged_out') {
  return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
}
if (authStatus === 'disabled') {
  return <DisabledScreen user={authUser} onSwitchAccount={handleSwitchAccount} />;
}
// 其余：正常主界面
```

---

### 3.5 `electron-builder.json` — 协议注册

```json
// macOS
"extendInfo": {
  "CFBundleURLTypes": [
    { "CFBundleURLName": "com.diclaw.app", "CFBundleURLSchemes": ["diclaw"] }
  ]
}

// Windows
"win": {
  "protocols": [
    { "name": "DiClaw Protocol", "schemes": ["diclaw"] }
  ]
}
```

---

## 四、IPC 通信接口

### 渲染进程 → 主进程（invoke）

| 通道 | 说明 |
|------|------|
| `auth:openLoginUrl` | 在外部浏览器打开管理端登录页 |
| `auth:verify` | 联网校验本地 Token，返回 `AuthVerifyResult` |
| `auth:logout` | 清除本地 Token，可选通知管理端 |
| `auth:getCachedUser` | 获取缓存用户信息（不发网络请求） |

### 主进程 → 渲染进程（send）

| 通道 | 触发时机 | 数据 |
|------|---------|------|
| `auth:loginSuccess` | 深链接回调 Token 校验通过 | `AuthUser` 对象 |
| `auth:loginError` | 深链接 Token 无效 / 网络错误 | 错误文案字符串 |

---

## 五、管理端需要配合的工作

### 5.1 登录重定向

用户在管理端登录成功后，重定向到：

```
diclaw://auth?token=<JWT_OR_ACCESS_TOKEN>
```

### 5.2 需要提供的 API 接口

**Token 校验接口**：

```
GET /api/desktop/auth/verify
Authorization: Bearer {token}

Response 200（有效）:
{
  "code": 0,
  "data": {
    "user": { "id": "u123", "name": "张三", "email": "user@company.com" }
  }
}

Response 401 → Token 过期，桌面端清除本地 Token，跳至登录页
Response 403 → 账号已被禁用，桌面端显示禁用提示页
```

**登出接口**（可选）：

```
POST /api/desktop/auth/logout
Authorization: Bearer {token}
```

---

## 六、待补充配置（TODO）

在 `src/main/main.ts` 中搜索 `TODO: 替换`，将以下占位地址替换为真实地址：

| 占位地址 | 替换为 |
|---------|--------|
| `https://admin-test.yourcompany.com` | 测试环境管理端地址 |
| `https://admin.yourcompany.com` | 生产环境管理端地址 |

同样需要在 `src/renderer/services/endpoints.ts` 中替换对应注释里的占位地址。

---

## 七、本次自定义协议名称

| 协议名 | 用途 |
|--------|------|
| `diclaw://` | 桌面端深链接协议 |
| `diclaw://auth?token=xxx` | 管理端登录成功后回跳的 URL 格式 |
