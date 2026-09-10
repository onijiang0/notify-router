'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { createStore, genId } = require('./configStore');
const { extractText, decideTargets } = require('./router');
const { sendToChannel } = require('./channels');
const { createLogger } = require('./log');
const { renderUiHtml } = require('./ui');

// 当前版本(从 package.json 读, 启动时一次性取)
let APP_VERSION = '0.0.0';
try { APP_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version || APP_VERSION; } catch (e) {}

// 配置存储: 优先读 /app/config/config.json; 若配置了 Gist, 还会异步尝试从 Gist 拉回(应对卷丢失)
const store = createStore();
const logr = createLogger();

function log(...a) { console.log(new Date().toISOString(), ...a); }
function cfg() { return store.current(); }

const CHANNEL_TYPES = ['wecom', 'dingtalk', 'pushplus', 'generic'];

// ---------------- 核心: 处理一条通知 ----------------
async function handleNotify(payload, type) {
  const { title, content } = extractText(payload);
  if (!title && !content) return { ok: false, error: 'empty-notify', status: 400 };

  const c = cfg();
  const forceId = (type === 'test') ? (payload && payload._forceChannel) : null;
  let decision;
  if (forceId) {
    const ch = c.channels.find((x) => x.id === forceId);
    if (!ch) return { ok: false, error: 'forceChannel 不存在' };
    decision = { mode: 'direct', matched: { id: ch.id, name: ch.name, desc: '单渠道直测' }, channels: [ch.id] };
  } else {
    decision = decideTargets({ title, content }, { rules: c.rules, channels: c.channels, fallbackAll: c.fallbackAll });
  }
  const idToCh = new Map(c.channels.map((ch) => [ch.id, ch]));

  // 并行投递到所有目标渠道
  const results = [];
  for (const id of decision.channels) {
    const ch = idToCh.get(id);
    if (!ch) continue;
    const r = await sendToChannel(ch, title, content)
      .then((resp) => ({ id: ch.id, type: ch.type, name: ch.name, ok: true, resp }))
      .catch((e) => ({ id: ch.id, type: ch.type, name: ch.name, ok: false, error: e.message }));
    results.push(r);
  }
  const okAll = results.length > 0 && results.every((r) => r.ok);

  if (type !== 'test') {
    logr.push({
      type: type || 'notify', mode: decision.mode,
      rule: decision.matched ? decision.matched.id : '',
      targets: results.map((r) => `${r.type}:${r.id}`).join(','),
      title, content, error: okAll ? '' : results.filter((r) => !r.ok).map((r) => r.error).join('; '),
    });
  }

  if (decision.channels.length === 0) {
    // 无目标(可能全部规则未命中且 fallbackAll=false, 或无启用渠道)
    log(`[${type || 'notify'}] no-target mode=${decision.mode}`);
    return { ok: false, error: `no-target: ${decision.mode === 'none' ? '无规则命中且已关闭默认全发' : '没有任何启用渠道'}` };
  }

  log(`[${type || 'notify'}] mode=${decision.mode} matched=${decision.matched ? decision.matched.desc : '-'} -> ${results.map((r) => r.id + (r.ok ? '' : '✗')).join(',')}`);
  return { ok: okAll, mode: decision.mode, matched: decision.matched, results };
}

// ---------------- HTTP 工具 ----------------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) { reject(new Error('body-too-large')); req.destroy(); } });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function startListener(port) {
  return new Promise((resolve) => {
    const s = http.createServer(router);
    s.on('error', (e) => { log('listen-error', e.message); resolve(null); });
    s.listen(port, '0.0.0.0', () => { log(`notify-router listening on 0.0.0.0:${port}`); resolve(s); });
  });
}
let server = null;

async function readJson(req) {
  const raw = await readBody(req);
  return JSON.parse(raw || '{}');
}

async function apiRouter(req, res, c) {
  const ok = (o) => sendJson(res, 200, o);
  const body = () => readJson(req).catch(() => ({}));

  // 读取当前配置
  if (req.method === 'GET' && req.url === '/config') {
    return sendJson(res, 200, { ok: true, config: c, file: store.getFilePath() });
  }

  // 保存整个 channels / rules / 一般字段(允许部分更新: 传什么改什么)
  if (req.method === 'POST' && req.url === '/config') {
    try {
      const patch = JSON.parse((await readBody(req)) || '{}');
      const saved = store.save(patch);
      log('config-updated persisted=' + saved.persisted + ' channels=' + saved.data.channels.length + ' rules=' + saved.data.rules.length);
      const port = saved.data.listenPort;
      if (server && port !== c.listenPort) {
        log(`port change ${c.listenPort} -> ${port}`);
        try { server.close(); } catch (e) {}
        server = await startListener(port);
        if (!server) return sendJson(res, 200, { ok: true, config: saved.data, persisted: saved.persisted, portRestart: 'failed' });
      }
      return sendJson(res, 200, { ok: true, config: saved.data, persisted: saved.persisted });
    } catch (e) { return sendJson(res, 400, { ok: false, error: 'bad-json: ' + e.message }); }
  }

  // 渠道 CRUD(增删改查都在 /api/config?其实由整存覆盖) —— 提供便捷子接口便于 UI
  if (req.url.startsWith('/channels') ) {
    // GET /api/channels -> 列表; POST /api/channels -> 新建; PATCH/POST /api/channels/:id
    const m = req.url.match(/^\/channels(?:\/([^/]+))?$/);
    if (req.method === 'GET' && m && !m[1]) return sendJson(res, 200, { ok: true, channels: c.channels });
    if (req.method === 'POST' && m && !m[1]) {
      try {
        const ch = await body();
        if (!CHANNEL_TYPES.includes(ch.type)) return sendJson(res, 400, { ok: false, error: 'invalid type' });
        if (c.channels.some((x) => x.id === ch.id)) return sendJson(res, 400, { ok: false, error: 'duplicate id' });
        const next = [...c.channels, ch];
        const saved = store.save({ channels: next });
        return sendJson(res, 200, { ok: true, config: saved.data });
      } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
    }
    if (req.method === 'PUT' && m && m[1]) {
      try {
        const ch = await body();
        const next = c.channels.map((x) => (x.id === m[1] ? ch : x));
        if (!c.channels.some((x) => x.id === m[1])) next.push(ch);
        const saved = store.save({ channels: next });
        return sendJson(res, 200, { ok: true, config: saved.data });
      } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
    }
    if (req.method === 'DELETE' && m && m[1]) {
      const next = c.channels.filter((x) => x.id !== m[1]);
      const saved = store.save({ channels: next });
      return sendJson(res, 200, { ok: true, config: saved.data });
    }
  }

  // 规则 CRUD
  if (req.url.startsWith('/rules')) {
    const m = req.url.match(/^\/rules(?:\/([^/]+))?$/);
    if (req.method === 'GET' && m && !m[1]) return sendJson(res, 200, { ok: true, rules: c.rules });
    if (req.method === 'POST' && m && !m[1]) {
      try {
        const r = await body();
        if (!r.channels || !r.channels.length) return sendJson(res, 400, { ok: false, error: '规则需指定至少一个目标渠道' });
        const next = [...c.rules, r];
        const saved = store.save({ rules: next });
        return sendJson(res, 200, { ok: true, config: saved.data });
      } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
    }
    if (req.method === 'PUT' && m && m[1]) {
      try {
        const r = await body();
        const next = c.rules.map((x) => (x.id === m[1] ? r : x));
        if (!c.rules.some((x) => x.id === m[1])) next.push(r);
        const saved = store.save({ rules: next });
        return sendJson(res, 200, { ok: true, config: saved.data });
      } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
    }
    if (req.method === 'DELETE' && m && m[1]) {
      const next = c.rules.filter((x) => x.id !== m[1]);
      const saved = store.save({ rules: next });
      return sendJson(res, 200, { ok: true, config: saved.data });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'not-found' });
}

async function router(req, res) {
  const u = req.url || '/';
  const url = u.split('?')[0];
  const c = cfg();

  // Web 管理界面(单页 SPA)
  if (req.method === 'GET' && (url === '/' || url === '/ui')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderUiHtml());
  }

  // 健康检查(统计启用渠道)
  if (req.method === 'GET' && url === '/health') {
    const enabled = c.channels.filter((x) => x.enabled);
    const ready = enabled.map((x) => x.type).filter(Boolean);
    return sendJson(res, 200, {
      ok: true, ts: Date.now(),
      channels: c.channels.map((x) => ({ id: x.id, type: x.type, enabled: x.enabled })),
      enabledCount: enabled.length, enabledTypes: ready,
      rules: c.rules.length, fallbackAll: c.fallbackAll,
      configFile: store.getFilePath(),
    });
  }

  // 配置与 CRUD API (把 /api/* 归一为 apiRouter 内部的 /config /channels /rules)
  if (url === '/api/config' || url.startsWith('/api/channels') || url.startsWith('/api/rules')) {
    const innerUrl = '/' + url.replace(/^\/api/, '').replace(/^\//, '');
    req.url = innerUrl; // 直接改写(每个请求独立对象), 保留 on/method 等原型方法
    return apiRouter(req, res, c);
  }

  // 导出配置(下载服务端 config.json 原文)
  if (req.method === 'GET' && url === '/api/config/export') {
    const ex = store.exportRaw();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="notify-router-config.json"',
    });
    return res.end(ex.json || '{}');
  }

  // 导入配置(接收上传的 JSON 字符串)
  if (req.method === 'POST' && url === '/api/config/import') {
    try {
      const raw = await readBody(req);
      const r = store.importRaw(raw);
      if (!r.ok) return sendJson(res, 400, r);
      log('config-imported persisted=' + r.persisted);
      return sendJson(res, 200, { ok: true, config: r.data, persisted: r.persisted });
    } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
  }

  // 当前版本(供 UI 显示/升级提示)
  if (req.method === 'GET' && url === '/api/version') {
    return sendJson(res, 200, { ok: true, version: APP_VERSION, configFile: store.getFilePath() });
  }

  // 检测升级: 远端 ghcr.io latest 的 digest(无需鉴权, 包已设 Public)。
  // 返回 { latestDigest, fetchedAt }; UI 配合自身当前 digest 显示是否有新版本。
  if (req.method === 'GET' && url === '/api/upgrade-check') {
    const repo = 'onijiang0/notify-router';
    try {
      // ghcr.io v2 协议: 拿匿名 token → 拉 manifest
      const tokenRes = await fetch('https://ghcr.io/token?scope=repository:' + repo + ':pull', {
        headers: { 'User-Agent': 'notify-router/' + APP_VERSION },
      }).then((r) => r.json()).catch(() => null);
      const token = tokenRes && tokenRes.token;
      const headers = { 'Accept': 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json', 'User-Agent': 'notify-router/' + APP_VERSION };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const mRes = await fetch('https://ghcr.io/v2/' + repo + '/manifests/latest', { headers });
      const digest = mRes.headers.get('docker-content-digest') || '';
      return sendJson(res, 200, { ok: true, repo, latestDigest: digest, httpStatus: mRes.status, fetchedAt: Date.now() });
    } catch (e) {
      return sendJson(res, 200, { ok: false, repo, error: e.message, fetchedAt: Date.now() });
    }
  }

  // Gist 云端备份状态/拉取/推送
  if (req.method === 'GET' && url === '/api/backup/status') {
    return sendJson(res, 200, { ok: true, ...store.gistStatus() });
  }
  if (req.method === 'POST' && url === '/api/backup/pull') {
    const r = await store.pullFromGist();
    if (!r.ok) return sendJson(res, 400, r);
    return sendJson(res, 200, { ok: true, persisted: r.persisted, data: r.data });
  }
  if (req.method === 'POST' && url === '/api/backup/push') {
    const r = await store.pushNow();
    if (!r.ok) return sendJson(res, 400, r);
    return sendJson(res, 200, r);
  }

  // 元信息: 渠道模板/类型(供 UI 新建用)
  if (req.method === 'GET' && url === '/api/meta') {
    return sendJson(res, 200, { ok: true, channelTypes: store.getChannelTypes() });
  }

  // 转发日志
  if (req.method === 'GET' && url === '/api/logs') {
    const qn = new URL(u, 'http://x').searchParams.get('n');
    return sendJson(res, 200, { ok: true, logs: logr.list(qn ? Number(qn) : 80) });
  }

  // 模拟测试投递(不走真实转发? 走真实, 但标记 type=test 不入日志)
  if (req.method === 'POST' && url === '/api/test') {
    try {
      const b = JSON.parse((await readBody(req)) || '{}');
      const result = await handleNotify(b, 'test');
      return sendJson(res, result.ok || result.results ? 200 : 502, result);
    } catch (e) { return sendJson(res, 500, { ok: false, error: e.message }); }
  }

  // 接收青龙/脚本通知
  if (req.method === 'POST' && url === '/notify') {
    let payload;
    try { payload = JSON.parse((await readBody(req)) || '{}'); }
    catch (e) { return sendJson(res, 400, { ok: false, error: 'bad-json' }); }
    try {
      const result = await handleNotify(payload, 'notify');
      return sendJson(res, result.ok ? 200 : 502, result);
    } catch (e) {
      log('internal-error', e.message);
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'not-found' });
}

(async () => {
  // 启动时: 异步尝试从 Gist 拉取(若 env 配置了 GIST_TOKEN/GIST_ID, 且本地无主文件).
  // 这样即使卷丢了, 也能从云端恢复配置(根治"重建容器配置全没").
  try {
    const r = await store.readAsync();
    if (r && r.from === 'gist-recovered') log('✨ 配置已从 GitHub Gist 恢复(本地卷可能丢失过)');
    else if (r && r.from && r.from.startsWith('file-bak-recovered')) log('✨ 配置已从 .bak 恢复(主文件损坏)');
  } catch (e) { log('gist-restore error:', e.message); }

  const c = cfg();
  const enabled = c.channels.filter((x) => x.enabled);
  if (enabled.length === 0) log('警告: 没有任何启用的通知渠道 (可在 UI「渠道管理」添加并启用)');
  for (const ch of c.channels) {
    if (!ch.enabled) continue;
    const incomplete = channelIncomplete(ch);
    if (incomplete) log(`渠道「${ch.name||ch.id}」(${ch.type}) 配置不完整: ${incomplete}`);
  }
  server = await startListener(c.listenPort);
  if (!server) {
    log('无法监听 ' + c.listenPort + ', 退出。请检查端口占用或用 UI 改 listenPort(需先在可用端口启动)');
    process.exit(1);
  }
  log(`config file: ${store.getFilePath()}`);
  log(`channels=${c.channels.length} (enabled=${enabled.length}) rules=${c.rules.length} fallbackAll=${c.fallbackAll} type 支持: ${store.getChannelTypes().join('/')}`);
})();

// 校验单个渠道关键字段是否配齐(用于启动警告)
function channelIncomplete(ch) {
  const cfgObj = ch.cfg || {};
  switch (ch.type) {
    case 'wecom': return cfgObj.key ? '' : '缺少 key';
    case 'dingtalk': return (cfgObj.accessToken && cfgObj.secret) ? '' : '缺少 accessToken/secret';
    case 'pushplus': return cfgObj.token ? '' : '缺少 token';
    case 'generic': return cfgObj.url ? '' : '缺少 url';
    default: return '';
  }
}
