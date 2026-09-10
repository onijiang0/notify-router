'use strict';
/**
 * 转发日志: 记录近期转发/请求结果, 供 Web UI 查看。
 *
 * 落盘说明: 早期版本是纯内存环形缓冲, 容器一重建日志就全没了 —— 一旦出现
 * "分流失效/没收到通知", 用户无从回看。现在改为可选持久化到配置卷
 * (notify-router.log.json), 容器重建后仍能看到最近记录。写盘做 800ms 防抖,
 * 失败静默(只影响可观测性, 绝不影响转发)。
 */
const fs = require('fs');
const path = require('path');
const MAX = 300;
const TITLE_MAX = 300;
const CONTENT_MAX = 2000;

function createLogger(cap, filePath) {
  const max = cap || MAX;
  const fp = filePath || '';
  let buf = [];

  // 启动时恢复历史(仅用于展示, 损坏则忽略)
  if (fp) {
    try {
      const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (Array.isArray(arr)) buf = arr.filter((x) => x && typeof x === 'object').slice(-max);
    } catch (e) { /* 无历史或已损坏 */ }
  }

  let timer = null;
  function flush() {
    timer = null;
    if (!fp) return;
    try {
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(buf), 'utf8');
    } catch (e) { /* 静默 */ }
  }
  function schedule() {
    if (!fp || timer) return;
    timer = setTimeout(flush, 800);
    if (timer.unref) timer.unref(); // 不阻塞进程退出
  }

  function push(entry) {
    const rec = { ts: new Date().toISOString(), ...entry };
    // 截断超长字段, 避免长日志把文件撑大
    if (typeof rec.title === 'string' && rec.title.length > TITLE_MAX) rec.title = rec.title.slice(0, TITLE_MAX) + '…';
    if (typeof rec.content === 'string' && rec.content.length > CONTENT_MAX) rec.content = rec.content.slice(0, CONTENT_MAX) + '…';
    buf.push(rec);
    if (buf.length > max) buf.splice(0, buf.length - max);
    schedule();
    return rec;
  }
  function list(n) {
    const take = n && n > 0 ? n : 50;
    return buf.slice(-take).reverse();
  }
  function clear() {
    buf = [];
    schedule();
  }
  return { push, list, clear };
}

module.exports = { createLogger };
