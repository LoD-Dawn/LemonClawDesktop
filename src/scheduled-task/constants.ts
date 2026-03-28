export const ScheduleKind = {
  At: 'at',
  Every: 'every',
  Cron: 'cron',
} as const;
export type ScheduleKind = typeof ScheduleKind[keyof typeof ScheduleKind];

export const PayloadKind = {
  AgentTurn: 'agentTurn',
  SystemEvent: 'systemEvent',
} as const;
export type PayloadKind = typeof PayloadKind[keyof typeof PayloadKind];

export const DeliveryMode = {
  None: 'none',
  Announce: 'announce',
  Webhook: 'webhook',
} as const;
export type DeliveryMode = typeof DeliveryMode[keyof typeof DeliveryMode];

export const DeliveryChannel = {
  Last: 'last',
} as const;

export const SessionTarget = {
  Main: 'main',
  Isolated: 'isolated',
} as const;
export type SessionTarget = typeof SessionTarget[keyof typeof SessionTarget];

export const WakeMode = {
  Now: 'now',
  NextHeartbeat: 'next-heartbeat',
} as const;
export type WakeMode = typeof WakeMode[keyof typeof WakeMode];

export const OriginKind = {
  IM: 'im',
  Cowork: 'cowork',
  Manual: 'manual',
} as const;
export type OriginKind = typeof OriginKind[keyof typeof OriginKind];

export const BindingKind = {
  NewSession: 'new_session',
  UISession: 'ui_session',
  IMSession: 'im_session',
  SessionKey: 'session_key',
} as const;
export type BindingKind = typeof BindingKind[keyof typeof BindingKind];

export const TaskStatus = {
  Success: 'success',
  Error: 'error',
  Skipped: 'skipped',
  Running: 'running',
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const IpcChannel = {
  List: 'scheduledTask:list',
  Get: 'scheduledTask:get',
  Create: 'scheduledTask:create',
  Update: 'scheduledTask:update',
  Delete: 'scheduledTask:delete',
  Toggle: 'scheduledTask:toggle',
  RunManually: 'scheduledTask:runManually',
  Stop: 'scheduledTask:stop',
  ListRuns: 'scheduledTask:listRuns',
  CountRuns: 'scheduledTask:countRuns',
  ListAllRuns: 'scheduledTask:listAllRuns',
  ResolveSession: 'scheduledTask:resolveSession',
  ListChannels: 'scheduledTask:listChannels',
  ListChannelConversations: 'scheduledTask:listChannelConversations',
  StatusUpdate: 'scheduledTask:statusUpdate',
  RunUpdate: 'scheduledTask:runUpdate',
  Refresh: 'scheduledTask:refresh',
} as const;
