/**
 * 集中管理所有业务 API 端点。
 * 后续新增的业务接口也应在此文件中配置。
 */

import { configService } from './config';

const isTestMode = () => {
  return configService.getConfig().app?.testMode === true;
};

// ===================== 管理端认证 =====================

/**
 * 管理端 API 根地址，主进程通过 IPC 调用时使用。
 * 渲染进程只需要知道"打开登录 URL"，具体 URL 由主进程管理。
 */
export const getAdminApiBase = () => isTestMode()
  ? 'http://114.132.74.2:3006'
  : 'http://114.132.74.2:3006';

/**
 * 管理端 Token 校验接口
 * GET {base}/api/v1/desktop/auth/verify
 * Authorization: Bearer {token}
 */
export const getAdminVerifyUrl = () => `${getAdminApiBase()}/api/v1/desktop/auth/verify`;

/**
 * 管理端登出接口（可选）
 * POST {base}/api/v1/desktop/auth/logout
 */
export const getAdminLogoutUrl = () => `${getAdminApiBase()}/api/v1/desktop/auth/logout`;

/**
 * 管理端提供的登录页 URL（在外部浏览器打开）
 * 登录成功后管理端会重定向到：diclaw://auth?token=xxx
 */
export const getAdminLoginUrl = () => isTestMode()
  ? 'http://114.132.74.2:3006/login?from=desktop'
  : 'http://114.132.74.2:3006/login?from=desktop';

// 自动更新
export const getUpdateCheckUrl = () => isTestMode()
  ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/diosclaw/test/update'
  : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/diosclaw/prod/update';

export const getFallbackDownloadUrl = () => isTestMode()
  ? 'https://diosclaw.inner.youdao.com/#/download-list'
  : 'https://diosclaw.youdao.com/#/download-list';

// Skill 商店
export const getSkillStoreUrl = () => isTestMode()
  ? 'https://api-overmind.youdao.com/openapi/get/luna/hardware/diosclaw/test/skill-store'
  : 'https://api-overmind.youdao.com/openapi/get/luna/hardware/diosclaw/prod/skill-store';
