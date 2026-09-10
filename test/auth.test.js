'use strict';
/**
 * 登录鉴权端到端测试: 真实起 server.js 进程(配置 AUTH_USER/AUTH_PASS 环境变量),
 * 断言管理接口被 401 拦截、登录拿到会话 Cookie 后放行、/notify 与 /health 永远公开。
 * 运行: node test/auth.test.js
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const REPO = path.join(__dirname, '..');
const PORT = 18432;
const BASE = `http://127.0.0.1:${PORT}`;
const CFG = path.join(os.tmpdir(), `nr-auth-test-${Date.now()}.json`);

let passed = 0, failed = 0;
function check(name, fn) { return { name, fn }; }
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.log('  ✗', name, extra ? '(' + extra + ')' : ''); }
}

function req(method, url, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = http.request(BASE + url, {
      method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        data ? { 'Content-Length': Buffer.byteLength(data) } : {},
        cookie ? { Cookie: cookie } : {}
      ),
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, json: (() => { try { return JSON.parse(buf); } catch (e) { return {}; } })() }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function extractSetCookie(res) {
  const sc = res.headers['set-cookie'];
  if (!sc || !sc.length) return null;
  return sc[0].split(';')[0]; // "nr_session=xxx"
}

(async () => {
  // 清理可能残留的旧测试进程占用
  const srv = spawn(process.execPath, [path.join(REPO, 'src', 'server.js')], {
    cwd: REPO,
    env: Object.assign({}, process.env, {
      CONFIG_FILE: CFG,
      AUTH_USER: 'admin',
      AUTH_PASS: 's3cret-pass',
      LISTEN_PORT: String(PORT),
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let srvOut = '';
  srv.stdout.on('data', (d) => (srvOut += d));
  srv.stderr.on('data', (d) => (srvOut += d));

  // 等服务就绪
  let up = false;
  for (let i = 0; i < 50; i++) {
    try { await req('GET', '/health'); up = true; break; } catch (e) { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!up) { console.error('服务未起来:\n' + srvOut); srv.kill(); process.exit(1); }

  try {
    console.log('— 鉴权闸门 —');
    let r = await req('GET', '/api/config');
    ok('未登录访问管理接口 → 401', r.status === 401, 'got ' + r.status);
    r = await req('GET', '/api/logs');
    ok('未登录读日志 → 401', r.status === 401, 'got ' + r.status);
    r = await req('POST', '/api/config', { fallbackAll: false });
    ok('未登录改配置 → 401', r.status === 401, 'got ' + r.status);
    r = await req('GET', '/api/config/export');
    ok('未登录导出配置 → 401', r.status === 401, 'got ' + r.status);

    console.log('— 公开端点不受影响 —');
    r = await req('GET', '/health');
    ok('GET /health 公开', r.status === 200);
    r = await req('POST', '/notify', { title: 't', content: 'no-target-ok' });
    ok('POST /notify 公开(脚本投递不受登录影响)', r.status === 200 || r.status === 502, 'got ' + r.status);
    r = await req('GET', '/api/session');
    ok('GET /api/session 公开且 authRequired=true', r.status === 200 && r.json.authRequired === true && r.json.authenticated === false);
    r = await req('GET', '/');
    ok('GET / (SPA 外壳, 无敏感数据) 公开', r.status === 200 && r.headers['content-type'].includes('text/html'));

    console.log('— 登录 —');
    r = await req('POST', '/api/login', { user: 'admin', pass: 'wrong' });
    ok('错误密码 → 401', r.status === 401);
    ok('错误密码不带会话 Cookie', !extractSetCookie(r));
    r = await req('POST', '/api/login', { user: 'wrong', pass: 's3cret-pass' });
    ok('错误用户名 → 401', r.status === 401);
    r = await req('POST', '/api/login', { user: 'admin', pass: 's3cret-pass' });
    ok('正确凭据 → 200', r.status === 200 && r.json.ok === true);
    const cookie = extractSetCookie(r);
    ok('下发了 HttpOnly 会话 Cookie', !!cookie && cookie.startsWith('nr_session='));
    ok('Cookie 带 HttpOnly 标记', (r.headers['set-cookie'][0] || '').toLowerCase().includes('httponly'));

    console.log('— 会话放行 —');
    r = await req('GET', '/api/config', undefined, cookie);
    ok('带会话读配置 → 200', r.status === 200, 'got ' + r.status);
    r = await req('GET', '/api/logs?n=5', undefined, cookie);
    ok('带会话读日志 → 200', r.status === 200);
    r = await req('GET', '/api/version', undefined, cookie);
    ok('带会话读版本 → 200', r.status === 200);
    r = await req('POST', '/api/test', { title: '会话后的测试', content: 'x' }, cookie);
    ok('带会话投递测试 → 200/502', r.status === 200 || r.status === 502);
    r = await req('GET', '/api/session', undefined, cookie);
    ok('会话态 session.authenticated=true', r.json.authenticated === true);

    console.log('— 无效/注销会话 —');
    r = await req('GET', '/api/config', undefined, 'nr_session=deadbeef');
    ok('伪造令牌 → 401', r.status === 401);
    r = await req('POST', '/api/logout', undefined, cookie);
    ok('注销 → 200', r.status === 200);
    r = await req('GET', '/api/config', undefined, cookie);
    ok('注销后旧会话失效 → 401', r.status === 401);
  } finally {
    srv.kill();
    try { fs.unlinkSync(CFG); } catch (e) {}
    try { fs.unlinkSync(CFG + '.bak'); } catch (e) {}
  }

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
