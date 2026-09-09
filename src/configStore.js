'use strict';
/**
 * 通用通知分流网关 · 配置存储
 *
 * 数据模型(全部持久化在 config.json, 由 Web UI 编辑, 可热生效):
 *   channels[]  通知渠道定义(可插拔, 支持多种 type)
 *   rules[]     用户自定义分流规则(首个命中即用其 channels; 无命中则发全部 enabled)
 *   fallbackAll 兜底策略: 无规则命中时 true=发给所有启用渠道; false=不发送(仅记日志)
 *   listenPort  监听端口
 *   ui          界面美化(与运行无关)
 *
 * 环境变量仅作为"首次生成 config.json 时的初值"(向后兼容老部署),
 * 一旦文件存在则完全以文件为准, 环境变量不再覆盖。
 */

const fs = require('fs');
const path = require('path');

// ---------------- 默认值 ----------------

// 兼容老部署的字段(仍有对应 env), 保留以便 UI 显示旧式上下行摘要, 但分流以 channels/rules 为准
const FIELD_DEFAULTS = {
  listenPort: { env: 'LISTEN_PORT', def: 8080 },
  fallbackAll: { env: 'FALLBACK_ALL', def: true }, // 无规则命中时是否发全部启用渠道
  // 以下为兼容字段: 首次播种时若有对应 env 会注入为内置渠道
  wecomKey: { env: 'QYWX_KEY', def: '' },
  dingToken: { env: 'DINGTALK_ACCESS_TOKEN', def: '' },
  dingSecret: { env: 'DINGTALK_SECRET', def: '' },
};

const CHANNEL_TYPES = ['wecom', 'dingtalk', 'pushplus', 'generic'];

// 渠道默认定义模板(新建时用)
function channelTemplate(type, id) {
  const base = { id: id || genId('ch'), name: '', type, enabled: false, cfg: {} };
  switch (type) {
    case 'wecom':     base.cfg = { key: '' }; base.name = '企业微信机器人'; break;
    case 'dingtalk':  base.cfg = { accessToken: '', secret: '' }; base.name = '钉钉群机器人'; break;
    case 'pushplus':  base.cfg = { token: '', baseUrl: 'https://www.pushplus.plus/send' }; base.name = 'PushPlus'; break;
    case 'generic':   base.cfg = { method: 'POST', url: '', contentType: 'json', headers: {}, bodyTemplate: JSON.stringify({ title: '{{title}}', content: '{{content}}' }) }; base.name = '自定义Webhook'; break;
    default: break;
  }
  return base;
}

// 从环境变量播种出内置渠道(仅首次无 config.json 时)。沿用企微+钉钉作为两个渠道。
function channelsFromEnv() {
  const out = [];
  if (process.env.QYWX_KEY) {
    out.push({ id: 'wecom-main', name: '企业微信', type: 'wecom', enabled: true, cfg: { key: process.env.QYWX_KEY } });
  }
  if (process.env.DINGTALK_ACCESS_TOKEN) {
    out.push({
      id: 'ding-ops', name: '钉钉', type: 'dingtalk', enabled: true,
      cfg: { accessToken: process.env.DINGTALK_ACCESS_TOKEN, secret: process.env.DINGTALK_SECRET || '' },
    });
  }
  return out;
}

const UI_DEFAULTS = {
  mode: 'dark', accent: '#3b82f6', bgType: 'default', bgPreset: 'ocean',
  bgColor: '#0f1115', bgImage: '', bgDim: 0.45, radius: 12, customCss: '',
};

function initialFromEnv() {
  const out = {};
  for (const [k, meta] of Object.entries(FIELD_DEFAULTS)) {
    if (meta.env) {
      const v = process.env[meta.env];
      if (v !== undefined && v !== '') {
        out[k] = (typeof meta.def === 'boolean') ? v !== 'false' : v;
        continue;
      }
    }
    out[k] = meta.def;
  }
  out.channels = channelsFromEnv(); // 可能为空数组(无任何 env 时, 首次启动也正常)
  out.rules = [];
  out.ui = { ...UI_DEFAULTS };
  return out;
}

// ---------------- 规范化 ----------------

function sanitizeUi(patch) {
  const src = (patch && typeof patch === 'object') ? patch : {};
  const out = {};
  for (const k of Object.keys(UI_DEFAULTS)) {
    let v = src[k];
    if (v === undefined || v === null) { out[k] = UI_DEFAULTS[k]; continue; }
    switch (k) {
      case 'mode': out[k] = (String(v) === 'light') ? 'light' : 'dark'; break;
      case 'accent': out[k] = /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : UI_DEFAULTS.accent; break;
      case 'bgType': out[k] = ['default', 'preset', 'solid', 'image'].includes(String(v)) ? String(v) : UI_DEFAULTS.bgType; break;
      case 'bgPreset': out[k] = /^[\w-]{1,40}$/.test(String(v)) ? String(v) : UI_DEFAULTS.bgPreset; break;
      case 'bgColor': out[k] = /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : UI_DEFAULTS.bgColor; break;
      case 'bgImage': out[k] = String(v).slice(0, 400000); break;
      case 'bgDim': out[k] = Math.max(0, Math.min(0.85, Number(v) || 0)); break;
      case 'radius': out[k] = Math.max(0, Math.min(32, Number(v) || 0)); break;
      case 'customCss': out[k] = String(v).slice(0, 8000); break;
      default: out[k] = v;
    }
  }
  return out;
}

// 规范化单个渠道(白名单字段 + 类型约束)
function sanitizeChannel(c) {
  if (!c || typeof c !== 'object') return null;
  const type = CHANNEL_TYPES.includes(String(c.type)) ? String(c.type) : 'generic';
  const out = {
    id: String(c.id || genId('ch')).slice(0, 60),
    name: String(c.name || '').slice(0, 60),
    type,
    enabled: c.enabled === true || c.enabled === 'true',
    cfg: {},
  };
  const cfg = (c.cfg && typeof c.cfg === 'object') ? c.cfg : {};
  switch (type) {
    case 'wecom': out.cfg = { key: String(cfg.key || '') }; break;
    case 'dingtalk': out.cfg = { accessToken: String(cfg.accessToken || ''), secret: String(cfg.secret || '') }; break;
    case 'pushplus': out.cfg = { token: String(cfg.token || ''), baseUrl: String(cfg.baseUrl || 'https://www.pushplus.plus/send') }; break;
    case 'generic': {
      out.cfg = {
        method: String(cfg.method || 'POST').toUpperCase(),
        url: String(cfg.url || ''),
        contentType: String(cfg.contentType || 'json'), // 'json' | 'form' | 'raw'
        headers: (cfg.headers && typeof cfg.headers === 'object') ? cfg.headers : {},
        bodyTemplate: String(cfg.bodyTemplate || '').slice(0, 10000),
      };
      break;
    }
    default: break;
  }
  return out;
}

function sanitizeChannels(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const sc = sanitizeChannel(c);
    if (!sc) continue;
    if (seen.has(sc.id)) continue; // 去重
    seen.add(sc.id);
    out.push(sc);
  }
  return out;
}

// 规范化单条规则
function sanitizeRule(r) {
  if (!r || typeof r !== 'object') return null;
  const matchType = ['contains', 'regex', 'all'].includes(String(r.match)) ? String(r.match) : 'contains';
  const out = {
    id: String(r.id || genId('rule')).slice(0, 60),
    name: String(r.name || '').slice(0, 80),
    match: matchType,
    enabled: r.enabled === false || r.enabled === 'false' ? false : true,
    channels: Array.isArray(r.channels) ? r.channels.filter((x) => typeof x === 'string').slice(0, 20) : [],
  };
  if (matchType === 'contains') out.keyword = String(r.keyword || '').slice(0, 200);
  if (matchType === 'regex') {
    let pat = String(r.pattern || '').slice(0, 500);
    try { new RegExp(pat, 'i'); } catch (e) { pat = ''; } // 非法正则丢弃
    out.pattern = pat;
  }
  return out;
}

function sanitizeRules(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const r of list) {
    const sr = sanitizeRule(r);
    if (!sr) continue;
    // 校验至少有一个目标渠道, 且 channels 非空才有意义
    if (sr.channels.length === 0) continue;
    if (seen.has(sr.id)) continue;
    seen.add(sr.id);
    out.push(sr);
  }
  return out;
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------- 存储 ----------------

function createStore(filePath) {
  const fp = path.resolve(filePath || (process.env.CONFIG_FILE || '/app/config/config.json'));
  const bp = fp + '.bak'; // 自动备份: 每次 save 前把上一份复制到 .bak

  function tryRead(p) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      return { ok: true, data: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function read() {
    if (!fs.existsSync(fp)) {
      const seed = initialFromEnv();
      try {
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, JSON.stringify(seed, null, 2), 'utf8');
        return { data: seed, from: 'env-seed' };
      } catch (e) {
        return { data: seed, from: 'env-seed(no-write)' };
      }
    }
    // 主文件存在: 读 + sanitize; 若解析失败, 自动回退到 .bak
    const main = tryRead(fp);
    if (main.ok) {
      const merged = { ...initialFromEnv(), ...main.data };
      merged.channels = sanitizeChannels(merged.channels);
      merged.rules = sanitizeRules(merged.rules);
      merged.ui = sanitizeUi(main.data.ui || {});
      if ('fallbackAll' in main.data) merged.fallbackAll = main.data.fallbackAll === true || main.data.fallbackAll === 'true';
      return { data: merged, from: 'file' };
    }
    // 主文件损坏: 尝试从 .bak 恢复, 并写回主文件(若 .bak 有效)
    const bak = tryRead(bp);
    if (bak.ok) {
      try {
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, JSON.stringify(bak.data, null, 2), 'utf8');
      } catch (e) {}
      const merged = { ...initialFromEnv(), ...bak.data };
      merged.channels = sanitizeChannels(merged.channels);
      merged.rules = sanitizeRules(merged.rules);
      merged.ui = sanitizeUi(bak.data.ui || {});
      if ('fallbackAll' in bak.data) merged.fallbackAll = bak.data.fallbackAll === true || bak.data.fallbackAll === 'true';
      return { data: merged, from: 'file-bak-recovered:' + main.error };
    }
    return { data: initialFromEnv(), from: 'file-error:' + main.error };
  }

  let state = read();

  function current() {
    return JSON.parse(JSON.stringify(state.data)); // 深拷贝, 防外部误改
  }

  function save(patch) {
    const next = current(); // 以内存为基, 逐字段应用
    for (const [k, v] of Object.entries(patch || {})) {
      if (k === 'listenPort') { next.listenPort = Number(v) || FIELD_DEFAULTS.listenPort.def; }
      else if (k === 'fallbackAll') { next.fallbackAll = v === true || v === 'true'; }
      else if (k === 'channels') { next.channels = sanitizeChannels(v); }
      else if (k === 'rules') { next.rules = sanitizeRules(v); }
      else if (k === 'ui' && v && typeof v === 'object') { next.ui = sanitizeUi({ ...next.ui, ...v }); }
      // 其余(兼容字段)仅允许白名单字段, 且存字符串以防注入无关键
      else if (k in FIELD_DEFAULTS) { next[k] = String(v); }
    }
    state.data = next;
    let persisted = false;
    try {
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      // 写新值前, 把当前主文件复制到 .bak 作为"上一次成功保存"的快照
      try { fs.copyFileSync(fp, bp); } catch (e) { /* 无旧文件或权限, 忽略 */ }
      fs.writeFileSync(fp, JSON.stringify(next, null, 2), 'utf8');
      persisted = true;
    } catch (e) { /* 仅内存 */ }
    return { ok: true, data: current(), persisted };
  }

  // 直接整体替换(用于一次性 import/导入)
  function replaceAll(obj) {
    const next = { ...initialFromEnv(), ...(obj || {}) };
    next.channels = sanitizeChannels(next.channels);
    next.rules = sanitizeRules(next.rules);
    next.ui = sanitizeUi(next.ui || {});
    state.data = next;
    let persisted = false;
    try {
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      try { fs.copyFileSync(fp, bp); } catch (e) { /* 无旧文件, 忽略 */ }
      fs.writeFileSync(fp, JSON.stringify(next, null, 2), 'utf8');
      persisted = true;
    } catch (e) {}
    return { ok: true, data: current(), persisted };
  }

  function getFilePath() { return fp; }
  function getChannelTemplate(type) { return channelTemplate(type); }
  function getChannelTypes() { return CHANNEL_TYPES.slice(); }

  // 导出: 返回磁盘上 config.json 原文(不带 sanitize/合并), 便于外部精确备份
  function exportRaw() {
    try {
      return { ok: true, json: fs.readFileSync(fp, 'utf8') };
    } catch (e) {
      // 若磁盘没有文件, 用内存 current 兜底
      return { ok: true, json: JSON.stringify(state.data, null, 2), fromMemory: true };
    }
  }

  // 导入: 接收外部 JSON 字符串, 解析并 sanitize, 写盘 (同时刷新 .bak)
  function importRaw(jsonText) {
    let obj;
    try { obj = JSON.parse(jsonText); } catch (e) { return { ok: false, error: 'invalid-json: ' + e.message }; }
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'not-an-object' };
    // 复用 replaceAll 走 sanitize + 写盘
    const saved = replaceAll(obj);
    return { ok: true, data: saved.data, persisted: saved.persisted };
  }

  return { current, save, replaceAll, getFilePath, getChannelTemplate, getChannelTypes, exportRaw, importRaw };
}

module.exports = {
  createStore, sanitizeUi, sanitizeChannels, sanitizeRules, channelTemplate, genId,
  FIELD_DEFAULTS, UI_DEFAULTS, CHANNEL_TYPES,
};
