'use strict';
/**
 * 内存环形日志: 记录近期转发/请求结果, 供 Web UI 查看。
 */
const MAX = 300;

function createLogger(cap) {
  const max = cap || MAX;
  const buf = [];
  function push(entry) {
    const rec = { ts: new Date().toISOString(), ...entry };
    buf.push(rec);
    if (buf.length > max) buf.splice(0, buf.length - max);
    return rec;
  }
  function list(n) {
    const take = n && n > 0 ? n : 50;
    return buf.slice(-take).reverse();
  }
  return { push, list };
}

module.exports = { createLogger };
