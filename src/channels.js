'use strict';
/**
 * 通用渠道适配器注册表。
 * 每种 type 对应一个 send 函数, 输入 (cfg, title, content) 返回上游响应。
 * 内置: wecom / dingtalk / pushplus / generic(任意 webhook, 支持模板占位)。
 * 全部用 Node 内置 fetch, 无第三方依赖。
 */
const crypto = require('crypto');

// ---------- 模板替换: {{title}} {{content}} ----------
function render(template, vars) {
  if (typeof template !== 'string') return template;
  return template
    .replace(/\{\{\s*title\s*\}\}/g, () => safeString(vars.title))
    .replace(/\{\{\s*content\s*\}\}/g, () => safeString(vars.content));
}
// 模板里的值: 若整体 json 会序列化, 不能转义; 对纯文本占位则原样注入
function safeString(s) {
  return String(s == null ? '' : s);
}

async function sendWecom(cfg, title, content) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${cfg.key}`;
  const text = title ? `${title}\n${content}` : content;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.errcode !== 0) throw new Error(`wecom errcode=${body.errcode} ${body.errmsg || ''}`);
  return body;
}

function dingSign(secret, timestamp) {
  const str = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret).update(str).digest();
  return encodeURIComponent(Buffer.from(hmac).toString('base64'));
}

async function sendDingtalk(cfg, title, content) {
  const timestamp = Date.now();
  const sign = dingSign(cfg.secret, timestamp);
  const url = `https://oapi.dingtalk.com/robot/send?access_token=${cfg.accessToken}&timestamp=${timestamp}&sign=${sign}`;
  const text = title ? `${title}\n${content}` : content;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.errcode !== 0) throw new Error(`dingtalk errcode=${body.errcode} ${body.errmsg || ''}`);
  return body;
}

async function sendPushplus(cfg, title, content) {
  const baseUrl = cfg.baseUrl || 'https://www.pushplus.plus/send';
  const body = {
    token: cfg.token,
    title: title || '通知',
    content: content || '',
    template: 'txt',
  };
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }
  if (parsed && (parsed.code === 200 || parsed.code === 0 || parsed.msg === 'success' || parsed.success === true)) {
    return parsed;
  }
  throw new Error(`pushplus error code=${parsed.code} msg=${parsed.msg || text.slice(0, 200)}`);
}

// 通用 webhook 适配器: 支持 json / form / raw, bodyTemplate 用 {{title}}/{{content}} 占位
async function sendGeneric(cfg, title, content) {
  if (!cfg.url) throw new Error('generic: 未配置 url');
  const headers = { ...(cfg.headers || {}) };
  let payload = '';
  let contentType = 'application/json';

  const tpl = cfg.bodyTemplate || JSON.stringify({ title: '{{title}}', content: '{{content}}' });

  if (cfg.contentType === 'form') {
    // 期望 bodyTemplate 是一个 JSON 对象 {k: '{{title}}'}, 转 form 编码
    let obj;
    try { obj = JSON.parse(render(tpl, { title, content })); }
    catch (e) { obj = { title, content: tpl }; }
    contentType = 'application/x-www-form-urlencoded';
    payload = Object.entries(obj)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
  } else if (cfg.contentType === 'raw') {
    payload = render(tpl, { title, content });
    contentType = headers['Content-Type'] || 'text/plain';
  } else { // json
    let rendered = render(tpl, { title, content });
    // 若模板本身是 JSON 结构(含占位符在字符串值), 先尝试解析以支持 headers
    try { payload = JSON.stringify(JSON.parse(rendered)); }
    catch (e) { payload = rendered; } // 非JSON模板: 原样字符串(常见于 raw text 机器人)
    contentType = 'application/json';
  }
  if (!headers['Content-Type'] && !/^content-type$/i.test(Object.keys(headers).join(','))) {
    headers['Content-Type'] = contentType;
  }

  const res = await fetch(cfg.url, { method: cfg.method || 'POST', headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`generic HTTP ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch (e) { return { raw: text }; }
}

// ---------------- 注册表 ----------------
const ADAPTERS = {
  wecom:    { send: sendWecom,     label: '企业微信机器人' },
  dingtalk: { send: sendDingtalk,  label: '钉钉群机器人' },
  pushplus: { send: sendPushplus,  label: 'PushPlus' },
  generic:  { send: sendGeneric,   label: '自定义Webhook' },
};

function hasAdapter(type) { return type in ADAPTERS; }

// 发送到单个渠道。cfg 为渠道 cfg, 返回上游响应; 失败抛错由调用方捕获。
async function sendToChannel(channel, title, content) {
  const a = ADAPTERS[channel.type];
  if (!a) throw new Error(`不支持的渠道类型: ${channel.type}`);
  return a.send(channel.cfg || {}, title, content);
}

module.exports = { ADAPTERS, sendToChannel, dingSign, render };
