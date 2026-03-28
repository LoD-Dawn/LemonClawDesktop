import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  parseOpenClawWeixinSessionKey,
} = require('../dist-electron/shared/openclawSession.js');

test('parses Weixin DM session keys with explicit dm scope', () => {
  assert.deepEqual(
    parseOpenClawWeixinSessionKey('agent:main:openclaw-weixin:dm:alice@im.wechat'),
    { conversationId: 'alice@im.wechat' },
  );
});

test('parses Weixin DM session keys with account isolation', () => {
  assert.deepEqual(
    parseOpenClawWeixinSessionKey('agent:main:openclaw-weixin:wx-account-1:dm:alice@im.wechat'),
    { conversationId: 'alice@im.wechat', accountId: 'wx-account-1' },
  );
});

test('parses Weixin session keys embedded as JSON route context', () => {
  assert.deepEqual(
    parseOpenClawWeixinSessionKey(
      'agent:main:main:{"channel":"openclaw-weixin","peerid":"alice@im.wechat","accountid":"wx-account-1"}',
    ),
    { conversationId: 'alice@im.wechat', accountId: 'wx-account-1' },
  );
});

test('normalizes raw Weixin session keys with dm prefix', () => {
  assert.deepEqual(
    parseOpenClawWeixinSessionKey('openclaw-weixin:dm:alice@im.wechat'),
    { conversationId: 'alice@im.wechat' },
  );
});
