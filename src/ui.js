'use strict';
/**
 * notify-router · 通用通知分流网关 管理界面 (单文件 SPA, 多页面侧边栏导航)
 * 页面: 总览 / 发送投递 / 渠道管理 / 分流规则 / 转发日志 / 界面美化 / 系统设置
 * 主题可在线定制(明暗/强调色/背景/圆角/CSS), 持久化到服务端 config.json。
 */
const PRESETS = {
  ocean:    ['#0f2027', '#203a43', '#2c5364'],
  aurora:   ['#0f0c29', '#302b63', '#24243e'],
  sunset:   ['#355c7d', '#6c5b7b', '#c06c84'],
  forest:   ['#134e5e', '#71b280'],
  midnight: ['#232526', '#414345'],
  coral:    ['#2b5876', '#4e4376'],
  slate:    ['#232526', '#414345', '#0f2027'],
  carbon:   ['#3c3b3f', '#605c3c'],
};

function renderUiHtml() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>notify-router · 通用通知分流网关</title>
<style>
  :root{
    --bg:#0f1115; --panel:rgba(24,27,35,.82); --panel2:rgba(30,34,45,.72);
    --border:#2a2f3a; --text:#e6e9ef; --muted:#8b93a5; --accent:#3b82f6; --accent2:#60a5fa;
    --ok:#22c55e; --err:#ef4444; --warn:#f59e0b; --radius:12px;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;overflow:hidden;background:var(--bg);color:var(--text);
    font-family:-apple-system,"Segoe UI",Roboto,"Microsoft YaHei",sans-serif;font-size:14px;line-height:1.6}
  #bgLayer{position:fixed;inset:0;z-index:-2;background:var(--bg);background-size:cover;background-position:center;transition:background .4s ease}
  #bgScrim{position:fixed;inset:0;z-index:-1;background:rgba(0,0,0,0);transition:.3s}
  .layout{display:flex;height:100vh}
  /* 侧边栏 */
  .sidebar{width:236px;flex:0 0 236px;background:var(--panel);border-right:1px solid var(--border);
    display:flex;flex-direction:column;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
  .brand{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--border)}
  .brand .logo{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent2));
    display:flex;align-items:center;justify-content:center;font-size:17px;flex:0 0 auto}
  .brand h1{font-size:15px;margin:0;font-weight:700;line-height:1.2}
  .brand .sub{font-size:11px;color:var(--muted)}
  nav{flex:1;overflow-y:auto;padding:10px 8px}
  .group-label{font-size:11px;color:var(--muted);padding:10px 10px 4px;letter-spacing:.5px}
  nav a{display:flex;align-items:center;gap:10px;padding:9px 12px;margin:1px 0;border-radius:8px;
    color:var(--text);text-decoration:none;cursor:pointer;font-size:13.5px;transition:background .15s}
  nav a:hover{background:rgba(255,255,255,.05)}
  nav a.on{background:rgba(59,130,246,.16);color:#fff;box-shadow:inset 2px 0 0 var(--accent)}
  nav a .ic{width:20px;text-align:center;font-size:15px}
  .sidefoot{padding:12px 16px;border-top:1px solid var(--border)}
  .pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11.5px;font-weight:600}
  .pill.ok{background:rgba(34,197,94,.16);color:var(--ok);border:1px solid rgba(34,197,94,.35)}
  .pill.bad{background:rgba(239,68,68,.14);color:var(--err);border:1px solid rgba(239,68,68,.4)}
  .addr{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--accent2);word-break:break-all}
  /* 内容 */
  .content{flex:1;overflow-y:auto;position:relative}
  .topbar{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:12px;padding:14px 22px;
    background:var(--panel);border-bottom:1px solid var(--border);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .topbar .title{font-size:16px;font-weight:700}
  .topbar .crumb{color:var(--muted);font-size:12px}
  .hamburger{display:none}
  .wrap{max-width:1120px;margin:0 auto;padding:20px 22px 60px}
  .view{display:none}
  .view.on{display:block;animation:fade .25s ease}
  @keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  h2{font-size:16px;margin:6px 0 14px;padding-left:10px;border-left:3px solid var(--accent)}
  .grid{display:grid;gap:14px}
  .g3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
  .g2{grid-template-columns:1fr 1fr}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .card .t{font-size:12px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;gap:6px}
  .stat .num{font-size:30px;font-weight:800}
  .stat .chips{margin-top:6px;display:flex;flex-wrap:wrap;gap:5px}
  .chip{font-size:11px;padding:2px 8px;border-radius:20px;border:1px solid var(--border);background:var(--panel2)}
  .chip.on{border-color:rgba(34,197,94,.4);color:var(--ok)}
  label{display:block;font-size:12.5px;color:var(--text);margin:10px 0 4px}
  input[type=text],input[type=password],input[type=number],select,textarea{
    width:100%;padding:8px 11px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);
    color:var(--text);font-size:13.5px;outline:none}
  input:focus,select:focus,textarea:focus{border-color:var(--accent)}
  textarea{resize:vertical;min-height:70px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px}
  .row{display:flex;gap:12px}.row>*{flex:1}
  .row.tight{gap:8px}
  button{background:var(--accent);color:#fff;border:none;padding:8px 15px;border-radius:8px;cursor:pointer;
    font-size:13.5px;transition:filter .15s;display:inline-flex;align-items:center;gap:6px}
  button:hover{filter:brightness(1.12)}
  button.ghost{background:transparent;color:var(--text);border:1px solid var(--border)}
  button.ghost:hover{border-color:var(--accent);color:var(--accent)}
  button.danger{background:transparent;border:1px solid rgba(239,68,68,.5);color:var(--err)}
  button.danger:hover{background:rgba(239,68,68,.12)}
  button.okg{background:rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.5);color:var(--ok)}
  button.sm{padding:4px 10px;font-size:12.5px}
  button:disabled{opacity:.5;cursor:not-allowed}
  .switch{position:relative;width:40px;height:22px;display:inline-block;flex:0 0 auto}
  .switch input{opacity:0;width:0;height:0}
  .sl{position:absolute;inset:0;background:var(--panel2);border:1px solid var(--border);border-radius:20px;cursor:pointer;transition:.2s}
  .sl:before{content:"";position:absolute;height:16px;width:16px;left:2px;top:2px;background:#999;border-radius:50%;transition:.2s}
  .switch input:checked + .sl{background:var(--accent);border-color:var(--accent)}
  .switch input:checked + .sl:before{transform:translateX(18px);background:#fff}
  .lrow{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed var(--border)}
  .lrow:last-child{border-bottom:none}
  .kv{display:flex;justify-content:space-between;align-items:center}
  .kv .k{color:var(--muted)}
  .muted{color:var(--muted)}
  .mono{font-family:ui-monospace,Consolas,monospace}
  .log-item{border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:var(--panel2)}
  .log-item .hd{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px}
  .log-item .bd{margin-top:6px;font-size:12.5px;white-space:pre-wrap;word-break:break-all;color:var(--text)}
  .log-item .time{color:var(--muted);font-size:11px}
  .tag{font-size:11px;padding:1px 7px;border-radius:4px}
  .tag.ok{background:rgba(34,197,94,.16);color:var(--ok)}
  .tag.bad{background:rgba(239,68,68,.16);color:var(--err)}
  .tag.info{background:rgba(59,130,246,.16);color:var(--accent2)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border)}
  th{color:var(--muted);font-weight:600;font-size:12px;background:var(--panel2)}
  tr:hover td{background:rgba(255,255,255,.02)}
  .toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  .toolbar .sp{flex:1}
  .toast{position:fixed;top:20px;right:20px;z-index:99;max-width:360px;background:#1f2937;color:#fff;
    padding:11px 16px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.4);opacity:0;transform:translateY(-8px);
    transition:.25s;pointer-events:none;font-size:13px}
  .toast.show{opacity:1;transform:none}
  .toast.err{background:#b91c1c}
  .toast.ok{background:#15803d}
  .empty{color:var(--muted);text-align:center;padding:30px;font-size:13px}
  .resbox{font-family:ui-monospace,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:260px;overflow:auto}
  .swatches{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .sw{width:30px;height:30px;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:transform .1s}
  .sw:hover{transform:scale(1.1)}
  .sw.sel{border-color:#fff}
  .preset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:8px}
  .preset{height:64px;border-radius:10px;cursor:pointer;border:2px solid transparent;position:relative;overflow:hidden}
  .preset.sel{border-color:var(--accent)}
  .preset .pn{position:absolute;left:8px;bottom:6px;font-size:11px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7)}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:50;align-items:center;justify-content:center;padding:20px}
  .modal-bg.show{display:flex}
  .modal{background:var(--panel);border:1px solid var(--border);border-radius:14px;width:min(680px,100%);
    max-height:90vh;overflow-y:auto;padding:20px;backdrop-filter:blur(14px)}
  .modal h3{margin:0 0 6px}
  .modal .sub{color:var(--muted);font-size:12px;margin-bottom:14px}
  .modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}
  .seg{display:inline-flex;background:var(--panel2);border:1px solid var(--border);border-radius:9px;overflow:hidden}
  .seg button{background:transparent;border:none;color:var(--muted);padding:6px 14px;border-radius:0;font-size:13px}
  .seg button.on{background:var(--accent);color:#fff}
  .range{display:flex;align-items:center;gap:10px}
  input[type=range]{flex:1;accent-color:var(--accent)}
  .hint{font-size:11.5px;color:var(--muted);margin-top:4px}
  .code{background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:8px 11px;
    font-family:ui-monospace,Consolas,monospace;font-size:12px;word-break:break-all;color:var(--accent2)}
  .segrow{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .mt{margin-top:10px}
  @media(max-width:820px){
    .sidebar{position:fixed;left:0;top:0;bottom:0;z-index:30;transform:translateX(-100%);transition:transform .25s}
    .sidebar.open{transform:none;box-shadow:0 0 40px rgba(0,0,0,.5)}
    .hamburger{display:inline-flex}
    .content{margin-left:0}
    .g2{grid-template-columns:1fr}
  }
</style>
</head>
<body>
<div id="bgLayer"></div>
<div id="bgScrim"></div>
<div class="layout">
  <!-- ============ 侧边栏 ============ -->
  <aside class="sidebar" id="sidebar">
    <div class="brand">
      <div class="logo">🔀</div>
      <div>
        <h1>notify-router</h1>
        <div class="sub">通用通知分流网关</div>
      </div>
    </div>
    <nav id="nav">
      <div class="group-label">总览</div>
      <a data-v="overview" class="on"><span class="ic">📊</span>总览</a>
      <div class="group-label">投递</div>
      <a data-v="send"><span class="ic">📨</span>发送投递</a>
      <div class="group-label">配置</div>
      <a data-v="channels"><span class="ic">📣</span>渠道管理</a>
      <a data-v="rules"><span class="ic">🧭</span>分流规则</a>
      <a data-v="settings"><span class="ic">⚙️</span>系统设置</a>
      <div class="group-label">其它</div>
      <a data-v="logs"><span class="ic">📜</span>转发日志</a>
      <a data-v="beauty"><span class="ic">🎨</span>界面美化</a>
    </nav>
    <div class="sidefoot">
      <div style="margin-bottom:6px"><span id="healthPill" class="pill bad">连接中…</span></div>
      <div class="muted" style="font-size:11px;margin-bottom:3px">收件地址 (POST /notify)</div>
      <div class="addr" id="notifyUrl">–</div>
    </div>
  </aside>

  <!-- ============ 右侧内容 ============ -->
  <div class="content" id="content">
    <div class="topbar">
      <button class="ghost sm hamburger" id="btnMenu" title="菜单">☰</button>
      <span class="title" id="topTitle">总览</span>
      <span class="crumb muted" id="topCrumb"></span>
      <span style="margin-left:auto"></span>
    </div>

    <!-- 总览 -->
    <div class="view on" id="v-overview">
      <div class="wrap">
        <h2>运行总览</h2>
        <div class="grid g3">
          <div class="card stat">
            <div class="t">启用渠道</div>
            <div class="num" id="ovChOn">0</div>
            <div class="muted" id="ovChAll" style="font-size:12px">共 0 个渠道</div>
          </div>
          <div class="card stat">
            <div class="t">分流规则</div>
            <div class="num" id="ovRules">0</div>
            <div class="muted" style="font-size:12px">未命中默认发全部</div>
          </div>
          <div class="card stat">
            <div class="t">兜底策略</div>
            <div class="num" id="ovFallback" style="font-size:20px">–</div>
            <div class="muted" id="ovMode" style="font-size:12px">–</div>
          </div>
        </div>
        <div class="card mt" id="ovChannelList" style="margin-top:14px">
          <div class="t">渠道一览</div>
          <div class="chips" id="ovChips">加载中…</div>
        </div>
        <div class="card mt" style="margin-top:14px">
          <div class="t">如何接入(青龙/脚本)</div>
          <div style="font-size:13px;line-height:1.9">
            把脚本/青龙的通知地址指向网关收件口即可，网关按你的规则分流到各渠道：
            <div class="code" style="margin-top:6px" id="ovCurl">POST http://<ip>:<port>/notify  body: {"title":"标题","content":"正文"}</div>
            <div class="hint">无规则命中时默认把通知发给<strong>全部启用渠道</strong>；可在「分流规则」中让特定内容只走指定渠道。</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 发送投递 -->
    <div class="view" id="v-send">
      <div class="wrap">
        <h2>发送投递 (模拟收件)</h2>
        <div class="card">
          <div class="t">向网关投递一条通知，观察它被分流到哪些渠道(走真实发送)</div>
          <label>标题</label>
          <input type="text" id="s_title" placeholder="例如：每日签到">
          <label>正文</label>
          <textarea id="s_content" rows="3" placeholder="例如：本次共执行 12 个任务，全部成功"></textarea>
          <div class="toolbar" style="margin-top:14px">
            <button id="s_send">🚀 投递</button>
            <button class="ghost" id="s_sampleFail">填入失败样例</button>
            <button class="ghost" id="s_sampleOk">填入正常样例</button>
          </div>
        </div>
        <div class="card mt" style="margin-top:14px">
          <div class="t">投递结果</div>
          <div class="resbox" id="s_result" style="min-height:70px">尚未投递。</div>
        </div>
      </div>
    </div>

    <!-- 渠道管理 -->
    <div class="view" id="v-channels">
      <div class="wrap">
        <div class="toolbar">
          <h2 style="margin:0">渠道管理</h2>
          <span class="sp"></span>
          <button id="chAddBtn">＋ 新增渠道</button>
        </div>
        <div id="chList"></div>
      </div>
    </div>

    <!-- 分流规则 -->
    <div class="view" id="v-rules">
      <div class="wrap">
        <div class="toolbar">
          <h2 style="margin:0">分流规则</h2>
          <span class="sp"></span>
          <button id="ruleAddBtn">＋ 新增规则</button>
        </div>
        <div class="card" style="margin-bottom:14px">
          <div class="lrow" style="border:none">
            <div>
              <strong>默认策略</strong>
              <div class="hint">当通知<strong>未命中任何规则</strong>时：<br>开启=发送给<strong>全部启用渠道</strong>；关闭=不发送(仅记日志)</div>
            </div>
            <label class="switch" style="margin:0"><input type="checkbox" id="cfg_fallbackAll"><span class="sl"></span></label>
          </div>
        </div>
        <div id="ruleList"></div>
      </div>
    </div>

    <!-- 转发日志 -->
    <div class="view" id="v-logs">
      <div class="wrap">
        <div class="toolbar">
          <h2 style="margin:0">转发日志</h2>
          <span class="sp"></span>
          <span class="muted" style="font-size:12px">内存保留最近记录</span>
        </div>
        <div id="logList"></div>
      </div>
    </div>

    <!-- 系统设置 -->
    <div class="view" id="v-settings">
      <div class="wrap">
        <h2>系统设置</h2>
        <div class="card">
          <div class="lrow"><div><div><strong>监听端口</strong></div><div class="hint">容器内监听端口；改动需重启监听(容器对外映射需在部署时调整)</div></div>
            <input type="number" id="cfg_listenPort" style="width:140px"></div>
        </div>
        <div class="card mt" style="margin-top:14px">
          <div class="t">配置来源</div>
          <div class="lrow" style="border:none"><div class="code" id="cfg_file" style="flex:1">–</div>
            <button class="ghost sm" id="btnExport">导出配置</button>
            <button class="ghost sm" id="btnReload">重新载入</button></div>
          <div class="hint">导出 = 下载当前 config.json 副本，便于备份/迁移。</div>
        </div>
      </div>
    </div>

    <!-- 界面美化 -->
    <div class="view" id="v-beauty">
      <div class="wrap">
        <h2>界面美化 <span class="muted" style="font-weight:400;font-size:12px">(实时预览, 点保存后对所有人持久生效)</span></h2>
        <div class="grid g2">
          <div class="card">
            <div class="t">主题模式</div>
            <div class="seg" id="segMode">
              <button data-v="dark" class="on">深色</button>
              <button data-v="light">浅色</button>
            </div>
            <label>强调色</label>
            <div class="row tight">
              <input type="color" id="f_accent" value="#3b82f6" style="flex:0 0 44px;padding:2px">
              <input type="text" id="f_accentText" value="#3b82f6" placeholder="#3b82f6">
            </div>
            <div class="swatches" id="accentSw">
              <span class="sw" data-c="#3b82f6" style="background:#3b82f6"></span>
              <span class="sw" data-c="#8b5cf6" style="background:#8b5cf6"></span>
              <span class="sw" data-c="#ec4899" style="background:#ec4899"></span>
              <span class="sw" data-c="#f43f5e" style="background:#f43f5e"></span>
              <span class="sw" data-c="#f59e0b" style="background:#f59e0b"></span>
              <span class="sw" data-c="#22c55e" style="background:#22c55e"></span>
              <span class="sw" data-c="#14b8a6" style="background:#14b8a6"></span>
              <span class="sw" data-c="#e11d48" style="background:#e11d48"></span>
            </div>
            <label>背景类型</label>
            <div class="seg" id="segBgType">
              <button data-v="default">系统默认</button>
              <button data-v="preset">渐变预设</button>
              <button data-v="solid">纯色</button>
              <button data-v="image">图片</button>
            </div>
            <div id="presetBlock" style="display:none">
              <label>选择渐变</label>
              <div class="preset-grid" id="presetGrid"></div>
            </div>
            <div id="solidBlock" style="display:none;margin-top:10px">
              <label>纯色</label>
              <div class="row tight">
                <input type="color" id="f_bgColor" value="#0f1115" style="flex:0 0 44px;padding:2px">
                <input type="text" id="f_bgColorText" value="#0f1115">
              </div>
            </div>
            <div id="imageBlock" style="display:none;margin-top:10px">
              <label>图片 URL</label>
              <input type="text" id="f_bgImageUrl" placeholder="https://.../bg.jpg">
              <div class="toolbar" style="margin-top:6px">
                <label class="ghost sm" style="cursor:pointer;margin:0;display:inline-flex;align-items:center;border:1px solid var(--border);padding:5px 11px;border-radius:8px;color:var(--text)">
                  📁 本地上传(自动压缩)
                  <input type="file" id="f_bgImageFile" accept="image/*" style="display:none">
                </label>
                <button class="ghost sm" id="f_bgClear" title="清除背景图">清除</button>
              </div>
            </div>
            <label>背景压暗 <span id="dimVal" class="muted">45%</span></label>
            <div class="range"><input type="range" id="f_bgDim" min="0" max="85" value="45"></div>
          </div>
          <div class="card">
            <div class="t">卡片外观 & 高级</div>
            <label>卡片圆角 <span class="muted" id="radiusVal">12px</span></label>
            <div class="range"><input type="range" id="f_radius" min="0" max="26" value="12"></div>
            <label>自定义 CSS (注入任意样式, 覆盖变量即可)</label>
            <textarea id="f_customCss" rows="5" placeholder=":root{ --radius:18px; }  body{ letter-spacing:.3px; }"></textarea>
            <div class="hint">可用变量: --accent --bg --panel --panel2 --border --text --muted --radius</div>
            <button id="beautySave" style="margin-top:14px">💾 保存美化设置</button>
            <button class="ghost" id="beautyReset" style="margin-top:14px;margin-left:8px">恢复默认</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 模态框 -->
<div class="modal-bg" id="modalBg">
  <div class="modal" id="modalBox"></div>
</div>
<div class="toast" id="toast"></div>
<div id="notifyUrlHost"></div>

<script>
'use strict';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 浏览器端渐变预设(供 applyTheme 与 美化面板)
const PRESETS = {
  ocean: ['#0f2027', '#203a43', '#2c5364'],
  aurora: ['#0f0c29', '#302b63', '#24243e'],
  sunset: ['#355c7d', '#6c5b7b', '#c06c84'],
  forest: ['#134e5e', '#71b280'],
  midnight: ['#232526', '#414345'],
  coral: ['#2b5876', '#4e4376'],
  slate: ['#232526', '#414345', '#0f2027'],
  carbon: ['#3c3b3f', '#605c3c'],
};

/* ================= 状态 ================= */
let CFG = { channels:[], rules:[], fallbackAll:true, listenPort:8080, ui:{} };
let CUR_VIEW = 'overview';

/* ================= 主题引擎 ================= */
const MODE_CSS = {
  dark:  { '--panel':'rgba(23,26,35,.85)', '--panel2':'rgba(29,33,45,.78)', '--border':'#2b313d', '--text':'#e6e9ef', '--muted':'#8b93a5', '--headerbg':'rgba(15,17,21,.7)', '--panel-solid':'#151821' },
  light: { '--panel':'rgba(255,255,255,.86)', '--panel2':'rgba(243,244,246,.9)', '--border':'#e2e6ed', '--text':'#1e2430', '--muted':'#697386', '--headerbg':'rgba(255,255,255,.75)', '--panel-solid':'#ffffff' },
};
const uiFrom = (ui) => Object.assign({ mode:'dark', accent:'#3b82f6', bgType:'default', bgPreset:'ocean', bgColor:'#0f1115', bgImage:'', bgDim:0.45, radius:12, customCss:'' }, ui || {});
let curUi = uiFrom(CFG.ui);

function applyTheme(ui){
  curUi = uiFrom(ui);
  const root = document.documentElement;
  root.style.setProperty('--accent', curUi.accent);
  root.style.setProperty('--accent2', shade(curUi.accent, 30));
  root.style.setProperty('--radius', curUi.radius + 'px');
  root.classList.remove('theme-light','theme-dark');
  root.classList.add('theme-' + curUi.mode);
  const css = MODE_CSS[curUi.mode] || MODE_CSS.dark;
  for (const [k,v] of Object.entries(css)) root.style.setProperty(k, v);
  // 背景层
  const bg = $('bgLayer'), scrim = $('bgScrim');
  if (curUi.bgType === 'preset') {
    const colors = PRESETS[curUi.bgPreset] || PRESETS.ocean;
    bg.style.background = 'linear-gradient(135deg,' + colors.join(',') + ')';
    bg.style.backgroundImage = '';
  } else if (curUi.bgType === 'image' && curUi.bgImage) {
    bg.style.background = 'url("' + curUi.bgImage + '") center/cover no-repeat';
  } else if (curUi.bgType === 'solid') {
    bg.style.background = curUi.bgColor; bg.style.backgroundImage = '';
  } else {
    bg.style.background = curUi.mode === 'light' ? '#eef1f6' : '#0f1115';
  }
  scrim.style.background = (curUi.bgType !== 'default') ? 'rgba(0,0,0,' + curUi.bgDim + ')' : 'rgba(0,0,0,0)';
  // 自定义 CSS
  let st = document.getElementById('customCssEl');
  if (!st) { st = document.createElement('style'); st.id = 'customCssEl'; document.head.appendChild(st); }
  st.textContent = curUi.customCss || '';
  syncBeautyControls();
}
function shade(hex, pct){
  const n = parseInt(hex.slice(1),16); let r=n>>16,g=n>>8&255,b=n&255;
  const t = pct>0?255:0; pct=Math.abs(pct)/100;
  r=Math.round(r+(t-r)*pct); g=Math.round(g+(t-g)*pct); b=Math.round(b+(t-b)*pct);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function syncBeautyControls(){
  if (!CFG.ui) CFG.ui = curUi;
  const u = curUi;
  document.querySelectorAll('#segMode button').forEach(b=>b.classList.toggle('on', b.dataset.v===u.mode));
  document.querySelectorAll('#segBgType button').forEach(b=>b.classList.toggle('on', b.dataset.v===u.bgType));
  document.querySelectorAll('.sw[data-c]').forEach(s=>s.classList.toggle('sel', s.dataset.c===u.accent));
  document.querySelectorAll('#presetGrid .preset').forEach(p=>p.classList.toggle('sel', p.dataset.p===u.bgPreset));
  $('presetBlock').style.display = u.bgType==='preset' ? '' : 'none';
  $('solidBlock').style.display = u.bgType==='solid' ? '' : 'none';
  $('imageBlock').style.display = u.bgType==='image' ? '' : 'none';
  $('f_accent').value = u.accent; $('f_accentText').value = u.accent;
  $('f_bgColor').value = u.bgColor; $('f_bgColorText').value = u.bgColor;
  $('f_bgImageUrl').value = (u.bgType==='image' && /^https?:\\/\\//.test(u.bgImage||'')) ? u.bgImage : '';
  $('f_bgDim').value = Math.round((u.bgDim||0)*100);
  $('dimVal').textContent = Math.round((u.bgDim||0)*100)+'%';
  $('f_radius').value = u.radius; $('radiusVal').textContent = u.radius+'px';
  $('f_customCss').value = u.customCss || '';
}

/* ================= API ================= */
async function api(method, path, body){
  const opt = { method, headers:{'Content-Type':'application/json'} };
  if (body !== undefined) opt.body = JSON.stringify(body);
  const r = await fetch(path, opt);
  let j = {};
  try { j = await r.json(); } catch(e){}
  if (!r.ok) throw new Error(j.error || ('HTTP '+r.status));
  return j;
}
function toast(msg, type){
  const t = $('toast'); t.textContent = msg; t.className = 'toast show ' + (type||'');
  clearTimeout(toast._t); toast._t = setTimeout(()=> t.className='toast', 2600);
}

/* ================= 导航(多页面) ================= */
const V_TITLE = { overview:'运行总览', send:'发送投递', channels:'渠道管理', rules:'分流规则', logs:'转发日志', settings:'系统设置', beauty:'界面美化' };
const V_CRUMB = { overview:'通用通知分流网关 · 多渠道/自定义规则', send:'向网关投递一条消息, 观察分流去向', channels:'接入企微/钉钉/PushPlus/自定义Webhook', rules:'自定义匹配规则, 未命中默认发全部', logs:'最近转发明细', settings:'监听端口与配置', beauty:'界面在线美化, 保存即持久' };
function showView(v){
  CUR_VIEW = v;
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('on', el.id==='v-'+v));
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on', a.dataset.v===v));
  $('topTitle').textContent = V_TITLE[v] || '';
  $('topCrumb').textContent = V_CRUMB[v] || '';
  $('sidebar').classList.remove('open');
  // 按页面懒加载
  if (v==='channels') renderChannels();
  if (v==='rules') renderRules();
  if (v==='overview') renderOverview();
  if (v==='logs') loadLogs();
  if (v==='settings') renderSettings();
}
function navBind(){
  document.querySelectorAll('#nav a').forEach(a=>{
    a.addEventListener('click', ()=>{ showView(a.dataset.v); });
  });
  $('btnMenu').addEventListener('click', ()=> $('sidebar').classList.toggle('open'));
}

/* ================= 健康 & 顶部 ================= */
async function refreshHealth(){
  try {
    const h = await api('GET','/health');
    const en = h.enabledCount || 0;
    const p = $('healthPill');
    p.textContent = (en>0? en+' 渠道已启用' : '无启用渠道');
    p.className = 'pill ' + (en>0?'ok':'bad');
  } catch(e){
    $('healthPill').textContent = '服务不可达';
  }
}

/* ================= 总览 ================= */
function renderOverview(){
  const ch = CFG.channels||[];
  const on = ch.filter(c=>c.enabled);
  $('ovChOn').textContent = on.length;
  $('ovChAll').textContent = '共 '+ch.length+' 个渠道';
  $('ovRules').textContent = (CFG.rules||[]).length;
  $('ovFallback').textContent = CFG.fallbackAll!==false ? '发全部' : '不发送';
  $('ovMode').textContent = '未命中规则时 → ' + (CFG.fallbackAll!==false?'发送给所有启用渠道':'丢弃(仅记日志)');
  $('ovCurl').textContent = 'POST http://' + location.host + '/notify   body: {"title":"标题","content":"正文"}';
  const chips = on.map(c=>'<span class="chip on">'+typeIcon(c.type)+' '+esc(c.name||c.id)+'</span>').join('');
  const off = ch.filter(c=>!c.enabled);
  const chipsOff = off.map(c=>'<span class="chip">'+typeIcon(c.type)+' '+esc(c.name||c.id)+' (停用)</span>').join('');
  $('ovChips').innerHTML = chips + (chipsOff?('<div style="margin-top:6px">'+chipsOff+'</div>'):'');
}

/* ================= 渠道管理 ================= */
function typeIcon(t){ return t==='wecom'?'💬':t==='dingtalk'?'🔔':t==='pushplus'?'📮':'🔌'; }
function typeLabel(t){ return {wecom:'企业微信',dingtalk:'钉钉',pushplus:'PushPlus',generic:'自定义Webhook'}[t]||t; }
function cfgSummary(ch){
  const c = ch.cfg||{};
  if (ch.type==='wecom') return c.key? 'key: '+c.key.slice(0,8)+'…' : '未配置 key';
  if (ch.type==='dingtalk') return c.accessToken? 'token: '+c.accessToken.slice(0,8)+'…' : '未配置 token';
  if (ch.type==='pushplus') return c.token? 'token: '+c.token.slice(0,6)+'…' : '未配置 token';
  return c.url||'未配置 url';
}
function cfgComplete(ch){
  const c=ch.cfg||{};
  if (ch.type==='wecom') return !!c.key;
  if (ch.type==='dingtalk') return !!(c.accessToken && c.secret);
  if (ch.type==='pushplus') return !!c.token;
  if (ch.type==='generic') return !!c.url;
  return false;
}
function renderChannels(){
  const ch = CFG.channels||[];
  if (!ch.length){ $('chList').innerHTML = '<div class="empty">还没有渠道, 点击右上角「＋ 新增渠道」添加</div>'; return; }
  let h = '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">';
  for (const c of ch){
    const ok = cfgComplete(c);
    h += '<div class="card"><div style="display:flex;align-items:center;gap:10px">'
      + '<span style="font-size:20px">'+typeIcon(c.type)+'</span>'
      + '<div style="flex:1"><div style="font-weight:600">'+esc(c.name||c.id)+'</div>'
      + '<div class="muted" style="font-size:11.5px">'+typeLabel(c.type)+' · '+esc(c.id)+'</div></div>'
      + '<span class="'+(c.enabled?'tag ok':'tag bad')+'">'+(c.enabled?'启用':'停用')+'</span></div>'
      + '<div style="font-size:12px;color:var(--muted);margin:10px 0 4px">'+esc(cfgSummary(c))+'</div>'
      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
      + '<label class="switch" style="margin:0"><input type="checkbox" data-act="toggle" data-id="'+esc(c.id)+'" '+(c.enabled?'checked':'')+'><span class="sl"></span></label>'
      + '<span style="flex:1"></span>'
      + '<button class="ghost sm" data-act="test" data-id="'+esc(c.id)+'">测试</button>'
      + '<button class="ghost sm" data-act="edit" data-id="'+esc(c.id)+'">编辑</button>'
      + '<button class="danger sm" data-act="del" data-id="'+esc(c.id)+'">删除</button>'
      + '</div></div>';
  }
  h += '</div>';
  $('chList').innerHTML = h;
  // 事件绑定(BUG 修复): change 事件不冒泡, 不能绑在外层 .switch 上。
  // 必须把 toggle 监听直接绑到每个 checkbox(input) 本身, 否则启用开关点了毫无反应。
  $('chList').querySelectorAll('input[type="checkbox"][data-act="toggle"]').forEach(inp=>{
    inp.addEventListener('change', ()=> toggleChannel(inp.dataset.id, inp.checked));
  });
  // 按钮(编辑/删除/测试)走 click(click 会冒泡), 直接绑在按钮上
  $('chList').querySelectorAll('button[data-act]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const a = btn.dataset.act;
      if (a==='edit') openChannelModal(btn.dataset.id);
      else if (a==='del') delChannel(btn.dataset.id);
      else if (a==='test') testChannel(btn.dataset.id);
    });
  });
}
async function toggleChannel(id, on){
  const ch = CFG.channels.find(c=>c.id===id); if(!ch) return;
  ch.enabled = on;
  await saveChannels();
  renderChannels(); refreshHealth(); toast(on?'渠道已启用':'渠道已停用', on?'ok':'');
}
async function saveChannels(){
  const r = await api('POST','/api/config',{ channels: CFG.channels });
  CFG = r.config; toast('渠道配置已保存','ok');
}
function delChannel(id){
  const ch = CFG.channels.find(c=>c.id===id);
  modalConfirm('删除渠道「'+(ch?ch.name:id)+'」?','该渠道将从列表移除。已被它引用的规则会跳过此渠道。', async ()=>{
    CFG.channels = CFG.channels.filter(c=>c.id!==id);
    const r = await api('POST','/api/config',{ channels: CFG.channels });
    CFG = r.config; renderChannels(); refreshHealth(); toast('已删除','ok');
  });
}
function testChannel(id){
  // 单渠道直测: 打开一个只发给该渠道的投递
  const ch = CFG.channels.find(c=>c.id===id); if(!ch) return;
  $('modalBox').innerHTML =
    '<h3>测试渠道 · '+esc(ch.name||ch.id)+'</h3>'
    + '<div class="sub">'+typeIcon(ch.type)+' '+typeLabel(ch.type)+' · 发送一条真实测试消息到该渠道</div>'
    + '<label>标题</label><input type="text" id="tc_title" value="notify-router 渠道测试">'
    + '<label>正文</label><textarea id="tc_content" rows="3">这是来自 notify-router 的渠道连通性测试('+esc(new Date().toLocaleString())+')</textarea>'
    + '<div class="resbox mt" id="tc_res" style="min-height:50px"></div>'
    + '<div class="modal-foot"><button class="ghost" id="tc_close">关闭</button><button id="tc_send">发送</button></div>';
  $('modalBg').classList.add('show');
  $('tc_close').addEventListener('click', closeModal);
  $('tc_send').addEventListener('click', async ()=>{
    const btn=$('tc_send'); btn.disabled=true; btn.textContent='发送中…';
    $('tc_res').textContent='';
    try {
      const r = await api('POST','/api/test',{ title:$('tc_title').value, content:$('tc_content').value, _forceChannel:id });
      const one = (r.results||[])[0];
      $('tc_res').textContent = one ? (one.ok?'✓ 发送成功':'✗ 失败: '+one.error) : (r.error||'未投递');
    } catch(e){ $('tc_res').textContent = '发送失败: '+e.message; }
    finally { btn.disabled=false; btn.textContent='发送'; }
  });
}
function openChannelModal(id){
  const ch = id ? CFG.channels.find(c=>c.id===id) : null;
  const type = ch?ch.type:'wecom';
  $('modalBox').innerHTML = channelFormShell(ch, type);
  $('modalBg').classList.add('show');
  bindChannelForm(ch, type);
}
// 单渠道字段 HTML(不含外壳)
function channelFields(type, c){
  c = c||{};
  let b='';
  if (type==='wecom') b = '<label>Webhook key</label><input type="text" id="cf_key" value="'+esc(c.key||'')+'" placeholder="群机器人 key">';
  else if (type==='dingtalk') b = '<label>access_token</label><input type="text" id="cf_token" value="'+esc(c.accessToken||'')+'"><label>加签 secret</label><input type="text" id="cf_secret" value="'+esc(c.secret||'')+'">';
  else if (type==='pushplus') b = '<label>PushPlus token</label><input type="text" id="cf_token" value="'+esc(c.token||'')+'"><label>接口地址</label><input type="text" id="cf_baseUrl" value="'+esc(c.baseUrl||'https://www.pushplus.plus/send')+'">';
  else {
    const method = ['GET','PUT','POST'].includes(c.method)?c.method:'POST';
    b = '<label>请求方法</label><div class="seg" id="cf_method">'
      + ['GET','POST','PUT'].map(m=>'<button data-m="'+m+'" class="'+(method===m?'on':'')+'">'+m+'</button>').join('')
      + '</div>'
      + '<label>接口 URL</label><input type="text" id="cf_url" value="'+esc(c.url||'')+'" placeholder="https://api.example.com/webhook">'
      + '<label>Content-Type</label><div class="seg" id="cf_ct">'
      + ['json','form','raw'].map(t=>'<button data-v="'+t+'" class="'+(c.contentType===t||(t==='json'&&!c.contentType)?'on':'')+'">'+(t==='json'?'JSON':t==='form'?'表单':'纯文本')+'</button>').join('')
      + '</div>'
      + '<label>请求体模板 <span class="muted">({{title}}/{{content}})</span></label><textarea id="cf_bodyTemplate" rows="4">'+esc(c.bodyTemplate||'')+'</textarea>'
      + '<label>额外请求头 (JSON)</label><textarea id="cf_headers" rows="2" placeholder="{&quot;Authorization&quot;:&quot;Bearer xxx&quot;}">'+esc((c.headers&&Object.keys(c.headers).length)?JSON.stringify(c.headers):'')+'</textarea>'
      + '<div class="hint">JSON 模板示例: {"title":"{{title}}","content":"{{content}}"} · 文本机器人可填: 【{{title}}】\\n{{content}}</div>';
  }
  return b;
}
function channelFormShell(ch, type){
  const c = (ch&&ch.cfg)||{};
  const name = ch?ch.name:'';
  return '<h3>'+(ch?'编辑':'新增')+'渠道</h3><div class="sub">'+typeLabel(type)+' · 保存后即时生效</div>'
    + '<label>名称</label><input type="text" id="cf_name" value="'+esc(name)+'" placeholder="如: 企微-主群">'
    + '<label>类型</label><select id="cf_type">'
    + '<option value="wecom"'+(type==='wecom'?' selected':'')+'>企业微信机器人</option>'
    + '<option value="dingtalk"'+(type==='dingtalk'?' selected':'')+'>钉钉群机器人</option>'
    + '<option value="pushplus"'+(type==='pushplus'?' selected':'')+'>PushPlus</option>'
    + '<option value="generic"'+(type==='generic'?' selected':'')+'>自定义Webhook</option></select>'
    + '<div id="cf_fields">'+channelFields(type, c)+'</div>'
    + '<div class="modal-foot"><label class="switch" style="margin:0 10px 0 0;align-self:center"><input type="checkbox" id="cf_enabled" '+(ch&&ch.enabled?'checked':'')+'><span class="sl"></span></label>'
    + '<span class="muted" style="margin-right:auto;font-size:12px">启用</span>'
    + '<button class="ghost" id="cf_cancel">取消</button><button id="cf_save">保存</button></div>';
}
function bindChannelForm(ch, type){
  let curType = type;
  const onSegClick = (container) => {
    container.querySelectorAll('button').forEach(bt=>{
      bt.addEventListener('click', ()=>{ container.querySelectorAll('button').forEach(x=>x.classList.remove('on')); bt.classList.add('on'); });
    });
  };
  function rebindGenericSegs(){ if ($('cf_method')) onSegClick($('cf_method')); if ($('cf_ct')) onSegClick($('cf_ct')); }
  rebindGenericSegs();
  $('cf_type').addEventListener('change', ()=>{
    curType = $('cf_type').value;
    $('cf_fields').innerHTML = channelFields(curType, {});
    rebindGenericSegs();
  });
  $('cf_cancel').addEventListener('click', closeModal);
  $('cf_save').addEventListener('click', async ()=>{
    const name = $('cf_name').value.trim();
    if (!name) return toast('请填写渠道名称','err');
    const cfg = readCfgFields(curType);
    if (curType==='generic' && !cfg.url) return toast('请填写接口 URL','err');
    if (curType==='wecom' && !cfg.key) return toast('请填写 Webhook key','err');
    if (curType==='dingtalk' && !(cfg.accessToken&&cfg.secret)) return toast('请填写钉钉 token 和 secret','err');
    if (curType==='pushplus' && !cfg.token) return toast('请填写 PushPlus token','err');
    if (curType==='generic'){
      try { JSON.parse(cfg.headers && Object.keys(cfg.headers).length ? JSON.stringify(cfg.headers) : '{}'); } catch(e){ return toast('请求头不是合法 JSON','err'); }
    }
    const entry = { id: ch?ch.id:(genId('ch')), name, type:curType, enabled: $('cf_enabled').checked, cfg };
    CFG.channels = ch ? CFG.channels.map(x=>x.id===ch.id?entry:x) : [...CFG.channels, entry];
    const r = await api('POST','/api/config',{ channels: CFG.channels });
    CFG = r.config; closeModal(); renderChannels(); refreshHealth(); toast('渠道已保存','ok');
  });
  function readCfgFields(t){
    const v=(id)=>$(id)?$(id).value.trim():'';
    if (t==='wecom') return { key: v('cf_key') };
    if (t==='dingtalk') return { accessToken: v('cf_token'), secret: v('cf_secret') };
    if (t==='pushplus') return { token: v('cf_token'), baseUrl: v('cf_baseUrl')||'https://www.pushplus.plus/send' };
    let headers={}; try{ headers = JSON.parse($('cf_headers').value||'{}'); }catch(e){ headers={}; }
    const ct = $('cf_ct').querySelector('.on').dataset.v;
    const method = $('cf_method').querySelector('.on').dataset.m;
    return { method, url: v('cf_url'), contentType: ct, headers, bodyTemplate: $('cf_bodyTemplate').value };
  }
}

/* ================= 规则管理 ================= */
function renderRules(){
  // fallback switch
  $('cfg_fallbackAll').checked = CFG.fallbackAll!==false;
  const ch = CFG.channels||[];
  const rules = CFG.rules||[];
  if (!rules.length){ $('ruleList').innerHTML='<div class="empty">还没有分流规则。不设规则时, 所有通知都会发给全部启用渠道。可点右上角添加规则让特定内容只走指定渠道。</div>'; return; }
  let h='';
  for (const r of rules){
    h += '<div class="card" style="margin-bottom:10px">'
      + '<div style="display:flex;align-items:center;gap:10px"><span style="font-size:16px">🎯</span>'
      + '<div style="flex:1"><div style="font-weight:600">'+esc(r.name||r.id)+'</div>'
      + '<div class="muted" style="font-size:11.5px">'+matchDesc(r)+'</div></div>'
      + '<span style="flex:1"></span>'
      + '<button class="ghost sm" data-a="test" data-id="'+esc(r.id)+'">测试命中</button>'
      + '<button class="ghost sm" data-a="edit" data-id="'+esc(r.id)+'">编辑</button>'
      + '<button class="danger sm" data-a="del" data-id="'+esc(r.id)+'">删除</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'
      + (r.channels.map(id=>{const c=ch.find(x=>x.id===id); return '<span class="chip '+(c&&c.enabled?'on':'')+'">'+typeIcon(c?c.type:'?')+' '+esc(c?c.name:id)+'</span>';}).join('')||'<span class="muted">无目标渠道</span>')
      + '</div></div>';
  }
  $('ruleList').innerHTML=h;
  $('ruleList').querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const a=b.dataset.a, id=b.dataset.id;
      if (a==='edit') openRuleModal(id);
      if (a==='del') delRule(id);
      if (a==='test') testRuleHit(id);
    });
  });
  $('cfg_fallbackAll').onchange = async (e)=>{
    CFG.fallbackAll = e.target.checked;
    const r = await api('POST','/api/config',{ fallbackAll:CFG.fallbackAll });
    CFG = r.config; renderOverview(); renderRules(); toast('默认策略已更新','ok');
  };
}
function matchDesc(r){
  if (r.match==='contains') return '标题或正文 包含「'+esc(r.keyword)+'」 → '+chNames(r.channels);
  if (r.match==='regex') return '标题或正文 匹配 /'+esc(r.pattern)+'/i → '+chNames(r.channels);
  return '无条件命中(所有通知) → '+chNames(r.channels);
}
function chNames(ids){
  const ch=CFG.channels||[];
  return ids.map(id=>{const c=ch.find(x=>x.id===id); return (c&&c.name)||id;}).join('、');
}
function openRuleModal(id){
  const r = id ? CFG.rules.find(x=>x.id===id) : null;
  const ch = CFG.channels||[];
  $('modalBox').innerHTML =
    '<h3>'+(r?'编辑':'新增')+'分流规则</h3><div class="sub">规则按顺序匹配, 第一条命中的规则决定投递渠道</div>'
    + '<label>名称 <span class="muted">(如 失败任务走钉钉)</span></label><input type="text" id="rl_name" value="'+esc(r?r.name:'')+'">'
    + '<label>匹配方式</label><div class="seg" id="rl_match">'
    + '<button data-v="contains" '+(r&&r.match==='contains'||!r?'on':'')+'>包含关键词</button>'
    + '<button data-v="regex" '+(r&&r.match==='regex'?'on':'')+'>正则匹配</button>'
    + '<button data-v="all" '+(r&&r.match==='all'?'on':'')+'>全部命中</button></div>'
    + '<div id="rl_kwBlock"'+(r&&r.match==='regex'?' style="display:none"':'')+'>'
    + '<label>关键词 <span class="muted">(命中即走此规则)</span></label><input type="text" id="rl_keyword" value="'+esc(r?r.keyword:'')+'" placeholder="如: 失败、error、异常">'
    + '</div>'
    + '<div id="rl_reBlock"'+(r&&r.match==='regex'?'':' style="display:none"')+'>'
    + '<label>正则 <span class="muted">(忽略大小写, 如 签到.*成功)</span></label><input type="text" id="rl_pattern" value="'+esc(r?r.pattern:'')+'" placeholder="签到.*成功">'
    + '</div>'
    + '<label>投递到渠道 <span class="muted">(可多选)</span></label>'
    + '<div id="rl_chs" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">'
    + (ch.length?ch.map(c=>'<label class="chip" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:6px 10px"><input type="checkbox" value="'+esc(c.id)+'" data-chk="1" '+(r&&r.channels.includes(c.id)?'checked':'')+' style="width:auto">'+typeIcon(c.type)+' '+esc(c.name||c.id)+(c.enabled?'':' <span class="muted">(停用)</span>')+'</label>').join('')
      :'<span class="muted">请先在渠道管理添加渠道</span>')
    + '</div>'
    + '<div class="hint" style="margin-top:6px">未选中任何规则且启用的渠道为空时, 默认策略(发全部)会兜底</div>'
    + '<div class="modal-foot"><button class="ghost" id="rl_cancel">取消</button><button id="rl_save">保存</button></div>';
  $('modalBg').classList.add('show');
  bindRuleForm(r, ch);
}
function bindRuleForm(r, ch){
  document.querySelectorAll('#rl_match button').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('#rl_match button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
      $('rl_kwBlock').style.display = b.dataset.v==='contains'?'':'none';
      $('rl_reBlock').style.display = b.dataset.v==='regex'?'':'none';
    });
  });
  $('rl_cancel').addEventListener('click', closeModal);
  $('rl_save').addEventListener('click', async ()=>{
    const name = $('rl_name').value.trim();
    const match = document.querySelector('#rl_match .on').dataset.v;
    const targetIds = Array.from(document.querySelectorAll('#rl_chs input[data-chk]:checked')).map(x=>x.value);
    const channels = targetIds;
    if (!channels.length) return toast('请至少选择一个目标渠道','err');
    if (match==='contains' && !$('rl_keyword').value.trim()) return toast('请填写关键词','err');
    if (match==='regex' && !$('rl_pattern').value.trim()) return toast('请填写正则','err');
    if (match==='regex') { try { new RegExp($('rl_pattern').value); } catch(e){ return toast('正则不合法: '+e.message,'err'); } }
    const entry = { id: r?r.id:genId('rule'), name:name||(r?r.name:'未命名'), match, enabled:true };
    if (match==='contains') entry.keyword = $('rl_keyword').value.trim();
    if (match==='regex') entry.pattern = $('rl_pattern').value.trim();
    entry.channels = channels;
    if (r) CFG.rules = CFG.rules.map(x=>x.id===r.id?entry:x);
    else CFG.rules = [...CFG.rules, entry];
    const sv = await api('POST','/api/config',{ rules: CFG.rules });
    CFG = sv.config; closeModal(); renderRules(); renderOverview(); toast('规则已保存','ok');
  });
}
function delRule(id){
  const r = CFG.rules.find(x=>x.id===id);
  modalConfirm('删除规则「'+(r?r.name:id)+'」?','删除后不再生效', async ()=>{
    CFG.rules = CFG.rules.filter(x=>x.id!==id);
    const sv = await api('POST','/api/config',{ rules: CFG.rules });
    CFG = sv.config; renderRules(); renderOverview(); toast('已删除','ok');
  });
}
function testRuleHit(id){
  // 填样例让用户判断该规则是否命中, 简单起见打开 send 页提示
  openTestHit(id);
}
function openTestHit(ruleId){
  showView('send');
  const r = CFG.rules.find(x=>x.id===ruleId);
  if (!r) return;
  if (r.match==='contains') $('s_content').value = '任务执行失败: 接口返回 error 500\\n('+r.keyword+' 样例)';
  else if (r.match==='regex') $('s_content').value = '签到成功 今日已完成';
  else $('s_content').value = '任意内容';
  toast('已填入样例, 点「投递」验证 → 应只发 '+chNames(r.channels), '');
}

/* ================= 系统设置 ================= */
let settingsBound = false;
function renderSettings(){
  $('cfg_listenPort').value = CFG.listenPort||8080;
  $('cfg_file').textContent = CFG._file || '(在服务器 /app/config/config.json)';
  if (settingsBound) return;
  settingsBound = true;
  $('cfg_listenPort').addEventListener('change', async (e)=>{
    const p = Number(e.target.value);
    if (!p || p<1 || p>65535) return toast('非法端口','err');
    const r = await api('POST','/api/config',{ listenPort: p });
    CFG = r.config; toast('端口已保存; 监听已热切换','ok');
  });
  $('btnExport').onclick = ()=>{
    const blob = new Blob([JSON.stringify(CFG,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='notify-router-config.json'; a.click();
  };
  $('btnReload').onclick = async ()=>{ await loadConfig(); toast('已重新载入配置','ok'); };
}

/* ================= 日志 ================= */
async function loadLogs(){
  try {
    const d = await api('GET','/api/logs?n=80');
    const logs = d.logs||[];
    if (!logs.length){ $('logList').innerHTML='<div class="empty">暂无转发记录</div>'; return; }
    $('logList').innerHTML = logs.map(l=>{
      const ok = !l.error;
      return '<div class="log-item"><div class="hd"><span class="time">'+esc(new Date(l.ts).toLocaleString())+'</span>'
        + '<span class="tag '+(ok?'ok':'bad')+'">'+(ok?'✓':'✗')+'</span>'
        + '<span class="tag info">'+esc(l.mode==='rule'?'规则命中':'默认'+(l.mode==='all'?'(发全部)':'(未发)'))+'</span>'
        + '<span class="muted">'+esc(l.rule||l.mode||'')+'</span>'
        + '<span style="margin-left:auto" class="mono" style="font-size:11px">'+esc(l.targets||'')+'</span></div>'
        + '<div class="bd">'+esc(l.title)+'<br>'+esc(l.content)+'</div>'
        + (l.error?'<div style="color:var(--err);font-size:12px;margin-top:4px">'+esc(l.error)+'</div>':'')
        + '</div>';
    }).join('');
  } catch(e){ $('logList').innerHTML='<div class="empty">读取失败: '+esc(e.message)+'</div>'; }
}

/* ================= 发送投递 ================= */
function bindSend(){
  $('s_send').addEventListener('click', async ()=>{
    const title=$('s_title').value, content=$('s_content').value;
    if (!title && !content) return toast('请填写标题或正文','err');
    const btn=$('s_send'); btn.disabled=true; btn.textContent='投递中…';
    $('s_result').textContent = '投递中…';
    try {
      const r = await api('POST','/api/test',{title, content});
      const parts=[];
      parts.push('模式: '+(r.mode==='rule'?'规则命中':'默认发全部'));
      if (r.matched) parts.push('命中规则: '+(r.matched.name||r.matched.desc));
      parts.push('');
      (r.results||[]).forEach(x=> parts.push((x.ok?'✓':'✗')+' ['+typeLabel(x.type)+'] '+x.name+(x.ok?'':(' → '+x.error))));
      if (!(r.results||[]).length) parts.push('(未投递到任何渠道)');
      $('s_result').textContent = parts.join('\\n');
      loadLogs();
    } catch(e){
      $('s_result').textContent = '投递失败: '+e.message;
      // 尝试解析后端详细
    } finally { btn.disabled=false; btn.textContent='🚀 投递'; }
  });
  $('s_sampleFail').addEventListener('click', ()=>{ $('s_title').value='任务执行失败'; $('s_content').value='任务执行失败: 接口返回 error 500, 请检查 Cookie 是否过期'; });
  $('s_sampleOk').addEventListener('click', ()=>{ $('s_title').value='每日签到'; $('s_content').value='本次共执行 12 个任务, 全部成功'; });
}

/* ================= 界面美化事件 ================= */
function bindBeauty(){
  document.querySelectorAll('#segMode button').forEach(b=>b.addEventListener('click', ()=>{ curUi.mode=b.dataset.v; applyTheme(curUi); }));
  document.querySelectorAll('#segBgType button').forEach(b=>b.addEventListener('click', ()=>{ curUi.bgType=b.dataset.v; applyTheme(curUi); }));
  // 预设网格
  const grid = $('presetGrid');
  for (const [k, colors] of Object.entries(PRESETS)){
    const d=document.createElement('div'); d.className='preset'; d.dataset.p=k;
    d.style.background='linear-gradient(135deg,'+colors.join(',')+')';
    d.innerHTML='<span class="pn">'+k+'</span>';
    d.addEventListener('click', ()=>{ curUi.bgPreset=k; applyTheme(curUi); });
    grid.appendChild(d);
  }
  document.querySelectorAll('.sw[data-c]').forEach(s=>s.addEventListener('click', ()=>{ curUi.accent=s.dataset.c; applyTheme(curUi); }));
  $('f_accent').addEventListener('input', ()=>{ curUi.accent=$('f_accent').value; applyTheme(curUi); });
  $('f_accentText').addEventListener('change', ()=>{ if(/^#[0-9a-fA-F]{6}$/.test($('f_accentText').value)){ curUi.accent=$('f_accentText').value; applyTheme(curUi);} });
  $('f_bgColor').addEventListener('input', ()=>{ curUi.bgColor=$('f_bgColor').value; applyTheme(curUi); });
  $('f_bgColorText').addEventListener('change', ()=>{ if(/^#[0-9a-fA-F]{6}$/.test($('f_bgColorText').value)){ curUi.bgColor=$('f_bgColorText').value; applyTheme(curUi);} });
  $('f_bgDim').addEventListener('input', ()=>{ curUi.bgDim=Number($('f_bgDim').value)/100; applyTheme(curUi); });
  $('f_radius').addEventListener('input', ()=>{ curUi.radius=Number($('f_radius').value); applyTheme(curUi); });
  $('f_customCss').addEventListener('input', ()=>{ curUi.customCss=$('f_customCss').value; applyTheme(curUi); });
  $('f_bgImageUrl').addEventListener('change', ()=>{ if($('f_bgImageUrl').value){ curUi.bgImage=$('f_bgImageUrl').value; curUi.bgType='image'; applyTheme(curUi);} });
  $('f_bgClear').addEventListener('click', ()=>{ curUi.bgImage=''; curUi.bgType='default'; $('f_bgImageUrl').value=''; applyTheme(curUi); });
  $('f_bgImageFile').addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const dataUrl = await compressImage(f);
    if(!dataUrl) return;
    curUi.bgImage = dataUrl; curUi.bgType='image'; applyTheme(curUi);
    toast('图片已就绪, 点保存美化设置持久化');
  });
  $('beautySave').addEventListener('click', async ()=>{
    try {
      const r = await api('POST','/api/config',{ ui: curUi });
      CFG = r.config; toast('美化设置已保存, 对所有访问者生效','ok');
    } catch(e){ toast('保存失败: '+e.message,'err'); }
  });
  $('beautyReset').addEventListener('click', async ()=>{
    curUi = uiFrom({}); applyTheme(curUi);
    const r = await api('POST','/api/config',{ ui: curUi });
    CFG = r.config; toast('已恢复默认外观','ok');
  });
}
function compressImage(file){
  return new Promise((resolve)=>{
    const rd = new FileReader();
    rd.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const maxW=1600; let w=img.width,h=img.height;
        if (w>maxW){ h=h*maxW/w; w=maxW; }
        const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        resolve(cv.toDataURL('image/jpeg',0.72));
      };
      img.onerror = ()=> resolve(null);
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

/* ================= 配置加载 ================= */
async function loadConfig(){
  try {
    const d = await api('GET','/api/config');
    CFG = d.config || CFG;
    CFG._file = d.file || '';
    $('notifyUrl').textContent = location.host;
    $('ovCurl').textContent = 'POST http://'+location.host+'/notify   body: {"title":"标题","content":"正文"}';
    applyTheme(CFG.ui || {});
    renderOverview();
    if (CUR_VIEW==='channels') renderChannels();
    if (CUR_VIEW==='rules') renderRules();
    if (CUR_VIEW==='settings') renderSettings();
  } catch(e){
    toast('读取配置失败: '+e.message,'err');
  }
}

/* ================= 模态工具 ================= */
function closeModal(){ $('modalBg').classList.remove('show'); }
$('modalBg').addEventListener('click', (e)=>{ if(e.target===$('modalBg')) closeModal(); });
function modalConfirm(title, msg, onOk){
  $('modalBox').innerHTML='<h3>'+esc(title)+'</h3><div class="sub">'+esc(msg)+'</div>'
    +'<div class="modal-foot"><button class="ghost" id="mc_cancel">取消</button><button class="danger" id="mc_ok" style="background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.5);color:var(--err)">确认</button></div>';
  $('modalBg').classList.add('show');
  $('mc_cancel').addEventListener('click', closeModal);
  $('mc_ok').addEventListener('click', async ()=>{ closeModal(); try{ await onOk(); }catch(e){ toast('操作失败: '+e.message,'err'); } });
}

function genId(p){ return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

/* ================= 启动 ================= */
function init(){
  navBind();
  bindSend();
  bindBeauty();
  $('chAddBtn').addEventListener('click', ()=> openChannelModal(null));
  $('ruleAddBtn').addEventListener('click', ()=> openRuleModal(null));
  applyTheme(CFG.ui || {});
  refreshHealth();
  loadConfig();
  setInterval(()=>{ refreshHealth(); }, 20000);
  setInterval(()=>{ if (CUR_VIEW==='logs') loadLogs(); }, 6000);
}
init();
</script>
</body>
</html>
`;
}

module.exports = { renderUiHtml };
