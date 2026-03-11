import { app } from 'electron';
import crypto from 'crypto';
import { SqliteStore } from './sqliteStore';

const AUTH_KEY_PREFIX = 'auth.';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  [key: string]: unknown;
}

export interface AuthState {
  token: string;
  user: AuthUser;
  savedAt: number;
}

/**
 * AuthStore: 管理认证 token 的加密存储。
 * token 使用 AES-256-GCM 加密，密钥与本机 userData 路径绑定，
 * 数据库文件被复制到其他机器也不能解密。
 */
export class AuthStore {
  private encKey: Buffer;

  constructor(private store: SqliteStore) {
    // 用 userData 路径做 salt，绑定到当前机器
    const seed = 'diosclaw-auth-v1';
    const salt = app.getPath('userData');
    this.encKey = crypto.scryptSync(seed, salt, 32);
  }

  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // iv(16) + tag(16) + ciphertext
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, 16);
    const tag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  /**
   * 保存 token 和用户信息
   */
  save(token: string, user: AuthUser): void {
    const state: AuthState = { token, user, savedAt: Date.now() };
    this.store.set(`${AUTH_KEY_PREFIX}state`, this.encrypt(JSON.stringify(state)));
  }

  /**
   * 读取 token（解密）
   */
  getToken(): string | null {
    const encrypted = this.store.get<string>(`${AUTH_KEY_PREFIX}state`);
    if (!encrypted) return null;
    try {
      const state: AuthState = JSON.parse(this.decrypt(encrypted));
      return state.token ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 读取缓存的用户信息（不发网络请求）
   */
  getCachedUser(): AuthUser | null {
    const encrypted = this.store.get<string>(`${AUTH_KEY_PREFIX}state`);
    if (!encrypted) return null;
    try {
      const state: AuthState = JSON.parse(this.decrypt(encrypted));
      return state.user ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 清除 token（登出）
   */
  clear(): void {
    this.store.delete(`${AUTH_KEY_PREFIX}state`);
  }

  /**
   * 是否有本地 token
   */
  hasToken(): boolean {
    return this.getToken() !== null;
  }

  /**
   * 更新缓存的用户信息（不改动 token）
   */
  updateUser(user: AuthUser): void {
    const token = this.getToken();
    if (token) {
      this.save(token, user);
    }
  }
}
