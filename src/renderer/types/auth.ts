// 认证相关类型定义

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  isActive?: boolean;
  roles?: {
    isSuperAdmin?: boolean;
    isDepartmentAdmin?: boolean;
  };
  organization?: {
    id?: string;
    name?: string;
    type?: string;
    path?: string;
    level?: number;
  };
  department?: {
    id?: string;
    name?: string;
    type?: string;
    path?: string;
    level?: number;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * 认证状态
 * - checking: 启动中，正在校验 token
 * - logged_out: 无 token、token 失效或账号被禁用，需要重新登录
 * - logged_in: 已登录且校验成功
 */
export type AuthStatus = 'checking' | 'logged_out' | 'logged_in';

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
