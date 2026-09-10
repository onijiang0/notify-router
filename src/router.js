'use strict';
/**
 * 通用分流判定核心(纯逻辑, 便于单测)。
 *
 * 判定一条通知应投递到哪些渠道:
 *   1. 依次遍历启用中的 rules; 第一条"匹配"的规则决定目标渠道集合(规则可命中多个渠道)。
 *   2. 若没有任何规则命中: 按 fallbackAll 决定 —— true=发给全部 enabled 渠道(默认); false=不发送。
 *
 * 匹配方式(rule.match):
 *   contains  标题+正文里包含 rule.keyword(子串, 忽略大小写)
 *   regex     标题+正文匹配 rule.pattern(正则, 忽略大小写)
 *   all       该规则无条件命中(常与 channels=[] 之外用法: 用作"其余都发指定集合"的兜底规则)
 */

/**
 * 还原"字面量转义"的换行。
 *
 * 背景(实测踩坑): 青龙各脚本仓库(leafTheFish/smallfawn/shufflewzc 等)共用的
 * `tools/sendNotify.js` 在 webhookNotify 里会执行 `text.replaceAll('\n', '\\n')`,
 * 把【真实换行】换成两个字符的反斜杠 + n 再拼进请求体。
 * 本意是让 JSON 字符串合法, 但紧接着 JSON.stringify 又把这个反斜杠转义了第二次,
 * 于是网关收到的是字面量 "\n" —— 企微/钉钉会把它当普通文本, 长通知糊成一行。
 *
 * 发送端在别人仓库里, 改了会被 `git pull` 覆盖(且大写文件名过不了青龙 OpenAPI 校验),
 * 所以在网关侧做一次还原, 与发送端实现解耦。
 *
 * 只处理 `\n`, 刻意不碰 `\t` / `\r`:
 *   发送端只转义换行, 所以正文里出现的字面量 `\t`、`\r` 是**真实文本**而非转义,
 *   还原它们会改坏内容 —— 例如 Windows 路径 `C:\temp\a` 会变成 `C:<TAB>emp\a`
 *   (本测试用真实路径样本跑出来过)。宁可少还原也不能改坏。
 * 副作用: 正文里本身含字面量 "\n" 的文本(如粘贴的代码片段)会被换成换行, 属可接受代价。
 */
function unescapeText(s) {
  if (typeof s !== 'string' || s.indexOf('\\n') === -1) return s;
  return s.replace(/\\n/g, '\n');
}

/** 从 payload 中提取标题与正文(兼容 title/subject/name/desp/message 等常见字段名)。 */
function extractText(payload) {
  if (typeof payload === 'string') return { title: '', content: unescapeText(payload) };
  const p = payload || {};
  const title =
    p.title || p.subject || p.name || p.msgtitle || (typeof p.header === 'string' ? p.header : '') || '';
  const content =
    p.content || p.desp || p.describe || p.text || p.message || p.body || p.msg ||
    (typeof p.messageText === 'string' ? p.messageText : '') ||
    (typeof p.textContent === 'string' ? p.textContent : '') ||
    (typeof p.data === 'string' ? p.data : '') ||
    (p.data && typeof p.data === 'object' ? JSON.stringify(p.data) : '') || '';
  return { title: unescapeText(String(title)), content: unescapeText(String(content)) };
}

/**
 * 对规则做预处理缓存(编译正则), 提高热路径性能。
 * @param {Array} rules 已 sanitize 的规则数组
 */
function compileRules(rules) {
  return (rules || []).filter((r) => r && r.enabled !== false).map((r) => {
    if (r.match === 'regex') {
      let re = null;
      try { re = new RegExp(r.pattern, 'i'); } catch (e) { re = null; }
      return { ...r, _re: re };
    }
    if (r.match === 'contains') {
      // 关键词支持单字符串或字符串数组(OR 匹配, 命中任一即匹配)
      let kws = [];
      if (Array.isArray(r.keyword)) kws = r.keyword;
      else if (typeof r.keyword === 'string' && r.keyword.length) kws = [r.keyword];
      return { ...r, _kws: kws.map((k) => String(k).toLowerCase()).filter((k) => k.length > 0) };
    }
    return { ...r };
  });
}

/**
 * 决定目标渠道集合。
 * @param {{title:string, content:string}} msg
 * @param {{rules:Array, channels:Array, fallbackAll:boolean}} opt
 * @returns {{channels:Array<string id>, matched:null|{id,name,desc}, ruleIds:Array}}
 */
function decideTargets(msg, opt) {
  const text = `${msg.title || ''}\n${msg.content || ''}`.toLowerCase();
  const enabledCh = ((opt && opt.channels) || []).filter((c) => c && c.enabled);
  const rules = compileRules((opt && opt.rules) || []);
  const allIds = enabledCh.map((c) => c.id);

  for (const r of rules) {
    let hit = false;
    if (r.match === 'all') hit = true;
    else if (r._re) hit = r._re.test(text);
    else if (r._kws && r._kws.length) hit = r._kws.some((kw) => text.includes(kw));
    if (hit) {
      // 目标 = 该规则声明的渠道 ∩ 当前启用渠道(丢弃未启用的引用)
      const targets = allIds.filter((id) => r.channels.includes(id));
      const desc = ruleDesc(r);
      return {
        channels: targets,
        matched: targets.length ? { id: r.id, name: r.name || desc, desc } : null,
        ruleIds: [r.id],
        mode: 'rule',
      };
    }
  }

  // 无规则命中 → 默认发全部启用渠道
  const fb = opt && opt.fallbackAll === false ? false : true;
  return {
    channels: fb ? allIds : [],
    matched: null,
    ruleIds: [],
    mode: fb ? 'all' : 'none',
  };
}

function ruleDesc(r) {
  if (r.match === 'contains') {
    const kws = Array.isArray(r.keyword) ? r.keyword : (r.keyword ? [r.keyword] : []);
    if (kws.length === 0) return '包含「(空)❓」';
    if (kws.length === 1) return `包含「${kws[0]}」`;
    return `包含任一「${kws.join(' / ')}」`;
  }
  if (r.match === 'regex') return `匹配 /${r.pattern}/i`;
  return '全部命中';
}

module.exports = { extractText, decideTargets, compileRules, unescapeText };
