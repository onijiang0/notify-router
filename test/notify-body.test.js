'use strict';
/**
 * 通知正文格式回归测试。
 *
 * 复刻「发送端组包 → 网关解析」整条链路, 锁死一个真实踩过的坑:
 *   青龙各仓库共用的 tools/sendNotify.js 会把真实换行转义成【两字符】的 "\n",
 *   该转义被 JSON.stringify 二次转义后无法被对端还原, 导致企微/钉钉通知糊成一行。
 *
 * 链路 A: 发送端 sendNotify.webhookNotify —— 逐字照搬上游实现(parseString/parseBody/formatBodyFun)
 * 链路 B: 网关 JSON.parse(req.body) → extractText() —— 真实模块, 非复刻
 *
 * 运行: node test/notify-body.test.js
 */

const assert = require('assert');
const { extractText, unescapeText } = require('../src/router');

// ---------------------------------------------------------------------------
// A. 发送端复刻: 上游 tools/sendNotify.js 的 webhookNotify 组包逻辑
//    (源: smallfawn/QLScriptPublic main tools/sendNotify.js, 56010B, 未改动)
// ---------------------------------------------------------------------------
function parseString(input, valueFormatFn) {
  const regex = /(\w+):\s*((?:(?!\n\w+:).)*)/g;
  const matches = {};
  let match;
  while ((match = regex.exec(input)) !== null) {
    const [, key, value] = match;
    const _key = key.trim();
    if (!_key || matches[_key]) continue;
    let _value = value.trim();
    try {
      _value = valueFormatFn ? valueFormatFn(_value) : _value;
      matches[_key] = JSON.parse(_value);
    } catch (error) {
      matches[_key] = _value;
    }
  }
  return matches;
}

function parseBody(body, contentType, valueFormatFn) {
  if (contentType === 'text/plain' || !body) {
    return valueFormatFn && body ? valueFormatFn(body) : body;
  }
  return parseString(body, valueFormatFn);
}

/** 发送端最终落在 HTTP 请求体上的字节(等价于 httpClient 的 { json: body } 选项) */
function buildWireBody(text, desp, env) {
  const { WEBHOOK_BODY, WEBHOOK_CONTENT_TYPE } = env;
  const body = parseBody(WEBHOOK_BODY, WEBHOOK_CONTENT_TYPE, (v) =>
    v
      ?.replaceAll('$title', text?.replaceAll('\n', '\\n'))
      ?.replaceAll('$content', desp?.replaceAll('\n', '\\n')),
  );
  if (WEBHOOK_CONTENT_TYPE === 'application/json') return JSON.stringify(body);
  return body; // text/plain: 原样发字符串
}

/** 发送端是否会被 webhookNotify 的三条件守卫拦下(静默 return) */
function webhookWillFire(text, desp, env) {
  return Boolean(
    env.WEBHOOK_METHOD &&
    env.WEBHOOK_URL &&
    (env.WEBHOOK_URL.includes('$title') || (env.WEBHOOK_BODY || '').includes('$title')),
  );
}

// ---------------------------------------------------------------------------
// B. 网关侧: 真实 extractText
// ---------------------------------------------------------------------------
function gatewayParse(wireText) {
  const payload = JSON.parse(wireText); // server.js: payload = JSON.parse(await readBody(req))
  return extractText(payload);
}

/**
 * 打补丁前的 extractText(src/router.js v5.1.1 原文), 仅用于复现故障。
 * 修复后必须留着它, 否则「复现」用例会拿修好的函数去证明 bug 存在 —— 自证式假绿。
 */
function legacyExtractText(payload) {
  if (typeof payload === 'string') return { title: '', content: payload };
  const p = payload || {};
  const title = p.title || p.subject || p.name || p.msgtitle || (typeof p.header === 'string' ? p.header : '') || '';
  const content = p.content || p.desp || p.describe || p.text || p.message || p.body || p.msg || (p.data && typeof p.data === 'object' ? JSON.stringify(p.data) : '') || '';
  return { title: String(title), content: String(content) };
}
function gatewayParseLegacy(wireText) {
  return legacyExtractText(JSON.parse(wireText));
}

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------
// 真实样本: 2026-09-10 16:20 嘉立创签到(task 945 → wxapp/jlc.js)经网关转发的原文
const JLC_CONTENT = [
  '[16:20:33] 🔔嘉立创签到,开始!',
  '[16:20:33] 共找到2个账号',
  '[16:20:33] 账号[1] 使用缓存token',
  '[16:20:34] 账号[1] ✅ 今日已签到，已连续 7 天',
  '[16:20:34] 账号[1] ✅ 连续第7天奖励已领取',
  '[16:20:34] 账号[1] 📊 当前豆豆总数：26，有效期至 2026-12-31',
  '[16:20:34] 等待 1.81 秒...',
  '[16:20:36] 账号[2] 使用缓存token',
  '[16:20:36] 账号[2] ✅ 今日已签到，已连续 7 天',
  '[16:20:36] 账号[2] ✅ 连续第7天奖励已领取',
  '[16:20:36] 账号[2] 📊 当前豆豆总数：23，有效期至 2026-12-31',
  '[16:20:36] ==============📣Center 通知📣==============',
  '',
  '虚伪的眼泪，会伤害别人，虚伪的笑容，会伤害自己。    ----叛逆的鲁鲁修',
].join('\n');

// 极端样本: 双引号 / 反斜杠 / 制表符 / Windows 路径 / 中文引号 / emoji / URL 参数
// 注意 C:\temp\x 与 C:\Users\a\b 是"看起来像转义但不是"的路径, 用来锁住"别还原 \t"这条约束
const WILD_CONTENT = '账号[1] 返回 "已领取" & C:\\Users\\a\\b\n备注:\t第一行\n路径: C:\\temp\\x\n链接: https://x.com/a"b?c=1&d=2';

const PASS = [];
const FAIL = [];
function check(name, fn) {
  try { fn(); PASS.push(name); } catch (e) { FAIL.push(`${name}\n      ${e.message}`); }
}

// ---------------------------------------------------------------------------
// 1) 复现 bug: 现行 config.sh(占位符不加引号) + 未打补丁的网关
// ---------------------------------------------------------------------------
const ENV_CURRENT = {
  // 192.0.2.0/24 是 RFC 5737 保留给文档/示例的地址段, 不会指向任何真实主机
  WEBHOOK_URL: 'http://192.0.2.10:18081/notify',
  WEBHOOK_METHOD: 'POST',
  WEBHOOK_CONTENT_TYPE: 'application/json',
  WEBHOOK_BODY: 'title: $title\ncontent: $content',
};

check('1. 复现: 现行配置 + 旧网关 → 正文含字面量 \\n (即线上故障)', () => {
  const wire = buildWireBody('嘉立创签到', JLC_CONTENT, ENV_CURRENT);
  const { title, content } = gatewayParseLegacy(wire);
  assert.strictEqual(title, '嘉立创签到', '标题应正常');
  assert.ok(content.includes('\\n'), '应复现字面量 \\n');
  assert.ok(!content.includes('\n'), '不应有真实换行');
});

// ---------------------------------------------------------------------------
// 2) 修复验证: 现行 config.sh 不动 + 已打补丁的网关
// ---------------------------------------------------------------------------
check('2. 修复: 现行配置 + 新网关 → 换行正确还原', () => {
  const wire = buildWireBody('嘉立创签到', JLC_CONTENT, ENV_CURRENT);
  const { content } = gatewayParse(wire);
  assert.ok(!content.includes('\\n'), '不应再有字面量 \\n');
  assert.strictEqual(content, JLC_CONTENT, '正文应与发送端完全一致');
  assert.strictEqual(content.split('\n').length, 14, '应为 14 行');
});

check('3. 修复: 极端内容(引号/反斜杠/路径/制表符)不丢字、不破结构', () => {
  const wire = buildWireBody('签到', WILD_CONTENT, ENV_CURRENT);
  const { content } = gatewayParse(wire);
  assert.strictEqual(content, WILD_CONTENT, '正文应逐字还原');
  assert.ok(content.includes('C:\\Users\\a\\b'), '单反斜杠路径不应被误伤');
  assert.ok(content.includes('C:\\temp\\x'), '含 \\t 的 Windows 路径绝不能被还原成制表符');
  assert.ok(content.includes('"已领取"'), '双引号应保留');
  assert.ok(content.includes('\t'), '制表符应保留');
});

check('4. 幂等: 已是真实换行的正文不会被二次破坏', () => {
  const wire = JSON.stringify({ title: 't', content: 'a\nb\nc' });
  assert.strictEqual(gatewayParse(wire).content, 'a\nb\nc');
  assert.strictEqual(unescapeText('a\nb'), 'a\nb');
  assert.strictEqual(unescapeText('no escape here'), 'no escape here');
  assert.strictEqual(unescapeText(''), '');
});

check('5. 标题里的转义同样被还原(部分脚本把结论写在标题)', () => {
  assert.strictEqual(gatewayParse(JSON.stringify({ title: '任务A\\n失败', content: 'x' })).title, '任务A\n失败');
});

// ---------------------------------------------------------------------------
// 3) 免部署备选: 给占位符加引号 —— 不改网关也能还原换行
// ---------------------------------------------------------------------------
const ENV_QUOTED = { ...ENV_CURRENT, WEBHOOK_BODY: 'title: "$title"\ncontent: "$content"' };

check('6. 备选(加引号): 不改网关也能还原换行', () => {
  const wire = buildWireBody('嘉立创签到', JLC_CONTENT, ENV_QUOTED);
  assert.strictEqual(gatewayParse(wire).content, JLC_CONTENT, '应还原为真实换行');
});

check('7. 备选(加引号)的局限: 正文含双引号时退回字面量 \\n', () => {
  const wire = buildWireBody('签到', WILD_CONTENT, ENV_QUOTED);
  const { content } = gatewayParseLegacy(wire);
  assert.ok(content.includes('\\n'), '应为降级(仍有字面量 \\n)');
  // 且会把包裹用的引号一起带进正文 —— 所以这只是临时方案
  assert.ok(content.startsWith('"') && content.endsWith('"'), '降级时正文会多出包裹引号');
});

check('9. unescapeText 只吃字面量 \\n, 不碰 \\t / 单反斜杠(否则会改坏 Windows 路径)', () => {
  assert.strictEqual(unescapeText('a\\nb'), 'a\nb', '字面量 \\n 应还原为换行');
  assert.strictEqual(unescapeText('C:\\temp\\a'), 'C:\\temp\\a', 'C:\\temp 不能被改成制表符');
  assert.strictEqual(unescapeText('C:\\Users\\a'), 'C:\\Users\\a');
  assert.strictEqual(unescapeText('没有转义'), '没有转义');
  assert.strictEqual(unescapeText(''), '');
});

check('8. 守卫: WEBHOOK_METHOD 缺失 → 发送端静默不发(不报错)', () => {
  assert.strictEqual(webhookWillFire('t', 'c', { ...ENV_CURRENT, WEBHOOK_METHOD: '' }), false);
  assert.strictEqual(webhookWillFire('t', 'c', ENV_CURRENT), true);
});

// ---------------------------------------------------------------------------
// 结果
// ---------------------------------------------------------------------------
console.log('\n通知正文格式回归测试\n' + '='.repeat(52));
for (const p of PASS) console.log('  \x1b[32m✓\x1b[0m ' + p);
for (const f of FAIL) console.log('  \x1b[31m✗\x1b[0m ' + f);
console.log('='.repeat(52));
console.log(`通过 ${PASS.length} / ${PASS.length + FAIL.length}\n`);
process.exit(FAIL.length ? 1 : 0);
