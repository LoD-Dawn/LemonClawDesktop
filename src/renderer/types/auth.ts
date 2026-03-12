// 认证相关类型定义

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  orgSlug?: string;
  [key: string]: unknown;
}

/**
 * 认证状态
 * - checking: 启动中，正在校验 token
 * - logged_out: 无 token 或 token 失效，需要登录
 * - disabled: token 有效但账号被禁用
 * - logged_in: 已登录且校验成功
 */
export type AuthStatus = 'checking' | 'logged_out' | 'disabled' | 'logged_in';

/**
 * auth:verify IPC 返回结果
 */
export interface AuthVerifyResult {
  valid: boolean;
  user?: AuthUser;
  reason?: 'no_token' | 'expired' | 'disabled' | 'network_error';
}

/**
 * auth:logout IPC 返回结果
 */
export interface AuthLogoutResult {
  success: boolean;
}

