# notify-router — 通用通知分流网关（含 Web 管理界面）

一个**通用、可扩展**的通知分流网关：接收集群/脚本/任意程序的通知，**按你自己定义的规则**把不同内容分发到不同的通知渠道。内置企微、钉钉、PushPlus，并支持对接**任意自定义 Webhook**（Post/JSON 模板等）。

纯 Node 实现、**无第三方依赖**。带一个**多页面 Web 管理界面**（`http://<IP>:端口`），渠道、规则、兜底策略、界面美化全部**在线点鼠标配置**，保存即时生效并持久化，无需改环境变量重启。

## 核心能力（相比"只分两条通道"的大升级）

- **多渠道可插拔**：不只是企微+钉钉。支持 `wecom` / `dingtalk` / `pushplus` / `generic`(任意自定义 Webhook)，可加任意多个，各自独立启用/停用。
- **账号登录鉴权（v5.2.0+）**：容器里配置 `AUTH_USER` + `AUTH_PASS` 两个环境变量即开启 Web 管理界面登录；不配置则与旧版一致无鉴权。`/notify`、`/health` 永远公开，**脚本投递不受任何影响**。
- **隐私打码（v5.2.0+）**：侧边栏左下角的收件地址域名**常驻模糊**，点击才临时明文显示（8 秒后自动恢复隐藏），截图/投屏不再泄露域名。
- **用户自定义规则**：规则按顺序匹配，每条规则可把内容送到**一个或多个渠道**。匹配方式支持：
  - `包含关键词`（子串，忽略大小写）。**一条规则可写多个关键词，命中任意一个即匹配**；分隔符支持英文逗号 `,`、中文逗号 `，`、顿号 `、`、分号 `;`，例如 `失败、失效、error` 会被识别成 3 个独立关键词。
  - `正则匹配`（忽略大小写）
  - `全部命中`（无条件，用作"剩余都走指定集合"的兜底）
- **无规则命中 → 默认发全部启用渠道**（可一键关闭为"不发送"）。
- **侧边栏多页面导航**：总览 / 发送投递 / 渠道管理 / 分流规则 / 转发日志 / 界面美化 / 系统设置，互不干扰。
- **配置可随身带走**：系统设置里可**导出/导入**整个 `config.json`（异地备份、迁移、恢复），并在每次保存时自动写一份 `.bak`，主文件损坏启动时自动回退。
- **系统设置内可"检测升级"**：一键查询 `ghcr.io` 最新镜像 digest，核对小主机上是否已是最新版。

## 工作原理

```
任意来源通知 ──POST /notify──▶ notify-router
                                   │  依次遍历你的规则
                                   ├─ 命中规则1(如 含"失败") → 发到 规则1指定的渠道(可多个)
                                   ├─ 命中规则2(...)         → 发到 规则2指定渠道
                                   └─ 无任何规则命中          → 默认发全部启用渠道(fallbackAll)
```

## 目录结构

```
notify-router/
├─ src/
│  ├─ server.js       # HTTP: /(UI多页)、/api/config(export/import)、/api/channels、/api/rules、
│  │                  #        /api/test、/api/logs、/api/version、/api/upgrade-check、/health、POST /notify
│  │                  #        + 登录鉴权(AUTH_USER/AUTH_PASS 环境变量开启, 会话 Cookie)
│  ├─ configStore.js  # 配置存储: channels[]/rules[] 规范化 + config.json 持久化 + .bak自动备份/损坏回退 + 环境变量播种
│  ├─ router.js       # 规则引擎(纯逻辑): 遍历规则→首个命中定渠道; 否则全发; 入口还原字面量 \n
│  ├─ channels.js     # 渠道适配器注册表: wecom/dingtalk/pushplus/generic
│  ├─ log.js          # 内存环形转发日志
│  └─ ui.js           # 多页面 Web 管理界面(侧边栏导航/登录遮罩/地址打码)
├─ test/
│  ├─ notify-body.test.js  # 通知正文换行还原回归测试(发送端组包→网关解析全链路复刻)
│  └─ auth.test.js         # 登录鉴权端到端测试(真实起进程: 401 闸门/登录/会话/注销)
├─ Dockerfile
├─ docker-compose.yml
├─ package.json
└─ README.md
```

## 数据模型（config.json，由 UI 管理）

```jsonc
{
  "channels": [
    { "id":"wecom-main", "name":"企业微信主群", "type":"wecom",    "enabled":true,
      "cfg": { "key":"..." } },
    { "id":"ding-ops",   "name":"钉钉运维群",   "type":"dingtalk", "enabled":true,
      "cfg": { "accessToken":"...", "secret":"SEC..." } },
    { "id":"push-plus",  "name":"PushPlus",     "type":"pushplus", "enabled":false,
      "cfg": { "token":"...", "baseUrl":"https://www.pushplus.plus/send" } },
    { "id":"my-api",     "name":"自建接口",      "type":"generic",  "enabled":false,
      "cfg": { "method":"POST", "url":"https://...", "contentType":"json",
               "headers":{}, "bodyTemplate":"{\"title\":\"{{title}}\",\"content\":\"{{content}}\"}" } }
  ],
  "rules": [
    { "id":"r1", "name":"失败→钉钉", "match":"contains", "keyword":"失败",
      "channels":["ding-ops"] },
    { "id":"r2", "name":"签到成功→企微", "match":"regex", "pattern":"签到.*成功",
      "channels":["wecom-main"] }
  ],
  "fallbackAll": true,      // 无规则命中时: true=发全部启用渠道; false=不发
  "listenPort": 8080,
  "ui": { /* 界面美化 */ }
}
```

`generic` 渠道 bodyTemplate 支持占位符 **`{{title}}` / `{{content}}`**；`contentType` 可选 `json` / `form` / `raw`，`raw` 时模板即纯文本正文。这样几乎任何通知 API（Bark、Server酱、Telegram、飞书、自建接口……）都能接进来。

> **持久化**：这份文件存于挂载卷 `/app/config/config.json`。每次保存会自动写一份 `config.json.bak`（上一次成功快照）；启动时若主文件损坏，会自动用 `.bak` 回退，不会因写一半崩溃而丢光。系统设置页可一键**导出**（下载原文）或**导入**（覆盖恢复）。

---

## 一、通过 DPanel 部署（推荐，只点鼠标）

1. 打开 `https://<panel-host>/dpanel/ui`
2. **「镜像」→「构建」→ 本地上传 ZIP** → 上传 `notify-router-upload.zip` → 镜像名 `notify-router:latest` → 构建
3. **「容器」→「创建」**：
   - 镜像 `notify-router:latest`
   - **端口映射 主机 `18081` → 容器 `8080`**（宿主 8080 已被占，故用 18081）
   - 挂载**命名卷**到容器 `/app/config`（保存 UI 渠道/规则配置，重启不丢）
   - 环境变量只作**首次播种**，可填下方示例；之后以 UI / config.json 为准

> 构建时若拉 `node:20-slim` 慢，可把 Dockerfile 首行换成加速源：`FROM docker.1ms.run/library/node:20-slim`。

## 二、访问 Web 管理界面

```
http://<小主机IP>:18081
```

页面（左侧多页面导航，点击**进入对应页面**）：
- **登录**：容器配置了 `AUTH_USER`/`AUTH_PASS` 时，打开页面先弹登录遮罩（见「登录鉴权」章节）
- **总览**：启用渠道数、规则数、兜底策略、接入方式、渠道一览
- **发送投递**：模拟一条通知走网关，实时看它被分流到哪些渠道
- **渠道管理**：增删改渠道 + 一键启停 + 单渠道**连通性测试**。支持企微/钉钉/PushPlus/自定义Webhook
- **分流规则**：增删改规则，多选目标渠道；可设默认策略(无命中发全部/不发)
- **转发日志**：最近转发明细（模式、命中规则、投递渠道、正文），自动刷新
- **界面美化**：明暗主题、强调色、背景(渐变/纯色/上传图片)、压暗、圆角、自定义CSS，保存即持久
- **系统设置**：监听端口、配置来源、**导出/导入配置**、当前版本、**检测升级**

**转发地址（供青龙/脚本 POST）**：`http://<小主机IP>:18081/notify`

## 三、纯命令行本地构建/运行

```bash
cd notify-router
docker compose up -d --build
# 或无 docker：需 Node ≥18
node src/server.js     # 会生成本地 config.json
```
健康检查：`curl http://<服务器IP>:18081/health`

## 四、快速验证（用真实渠道跑一遍）

```bash
BASE=http://127.0.0.1:18081
# 假设你在 UI 里加过"含失败→钉钉"规则:
# 1) 含"失败" → 应只发钉钉
curl -X POST $BASE/notify -H 'Content-Type: application/json' \
  -d '{"title":"某任务执行","content":"任务执行失败: 接口返回 error 500"}'
# 2) 普通内容 → 无规则命中, 发全部启用渠道
curl -X POST $BASE/notify -H 'Content-Type: application/json' \
  -d '{"title":"每日签到","content":"本次共执行 12 个任务, 全部成功"}'
```
返回 `results[]` 逐渠道给出 ok/error。也可在 Web 界面「发送投递」直接测，更直观。

## 五、接入青龙面板（推荐：系统通知 → 自定义通知，一条通知设置搞定）

> **推荐做法**：青龙较新版本（≥ v2.13，含 v2.20.x）的 **系统设置 → 通知设置** 自带
> **「自定义通知（Webhook）」** 渠道。我们把它指向网关的 `POST /notify`，
> **不需要去改任何脚本 / sendNotify.js**，青龙每次任务结束自动调它 → 通知进网关 → 按你的规则分流。

### 5.1 青龙侧：新增一个自定义通知渠道

青龙 → **系统设置 → 通知设置**，把 **通知方式切换/新增为「自定义通知（webhook）」**，填 5 个字段：

| 青龙字段 | 填什么 |
|---|---|
| **webhookMethod** | `POST` |
| **webhookContentType** | `application/json` |
| **webhookUrl** | 下面 5.2 选一个 |
| **webhookHeaders** | `Content-Type: application/json`（单行即可） |
| **webhookBody** | 两行（青龙按多行 `key: value` 自动转成 JSON POST）：<br>`title: $title`<br>`content: $content` |

保存后青龙会把每条通知包装成
`{"title":"任务标题","content":"日志/详情", ...}` POST 到网关，网关的
`extractText` 自动取 `title` + `content`，之后按你 UI 里的规则分流。

### 5.2 webhookUrl 三个候选地址（青龙容器访问网关的通路）

青龙跑在 Docker 容器里，要选一个**青龙容器内能访问到** notify-router 的地址：

| # | 地址 | 说明 |
|---|---|---|
| 1 | `http://<宿主IP>:18081/notify` | 首选，最通用（例：`http://192.0.2.10:18081/notify`） |
| 2 | `http://notify-router:8080/notify` | 仅当青龙与网关**同 docker 网络**（都用 `docker compose` 且同一网络时） |

**判断用哪个**：进青龙宿主机终端（SSH / 面板终端）跑：

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"title":"ping","content":"test"}' http://192.0.2.10:18081/notify
# 返回 {"ok":true,...} → 这个地址可用
```

### 5.3 通知进网关后如何分流

进 `http://<IP>:18081` → 「分流规则」按需新增，例如：

- **包含 "失败" → 只发钉钉**（`match=contains, keyword=失败, channels=[钉钉]`）
- 其余普通成功通知 → 默认 `fallbackAll=true` 走**全部启用渠道**

**关键词写法（重要，踩过的坑）**：一条 `包含关键词` 规则里可以写多个词，**命中任意一个即匹配**。分隔符支持英文逗号 `,`、中文逗号 `，`、顿号 `、`、分号 `;`：

```
失败、失效、error        → 3 个关键词: 失败 / 失效 / error
失败, error, 异常        → 3 个关键词
```

> ⚠️ 老版本只认逗号，用顿号写的 `失败、失效、error` 会被当成**一整个关键词**去匹配正文，永远命中不了 → 规则静默失效、通知掉到兜底规则。**v5.1.1 起已兼容顿号并自动修复历史配置**。新增/编辑规则时，弹窗下方会实时显示"将按 N 个关键词「或」匹配"，可当场核对。

**排查建议**：若怀疑分流没生效，进「转发日志」页看每条记录的 `规则命中 / 默认(发全部)` 标记与目标渠道。日志自 v5.1.1 起**落盘保存最近 300 条**，容器重建后仍可回看。

### 5.4 青龙通知设置的两种粒度说明

| 入口 | 来源 | 是否经网关 |
|---|---|---|
| **① 系统通知**（任务结束自动发） | 青龙 → 系统设置 → 通知设置（含上面配的自定义通知） | ✅ 走网关 |
| **② 脚本 sendNotify** | 各仓库 sendNotify.js 读 config.json 里的官方渠道 key | ❌ 仍直发官方接口 |

- **推荐**：① 接好网关后，在青龙通知设置里**取消勾选/移除原来的企微、钉钉等官方渠道**，只留上面这条「自定义通知」→ 所有系统通知统一进网关、由网关规则决定投给谁。
- **入口②** 若你不想双发，可保留 config.json 官方 key 不动（多数仓库 sendNotify 无渠道时空跑、不影响任务）。

> 想彻底收口入口②，最干净的方式是不改各仓库 sendNotify.js，而是只靠入口①。若确需入口②也进网关，可参考下方 5.5 的脚本侧法（侵入式，仅当①不满足需求时）。

### 5.5（备选）脚本侧 / 任意程序接入

不依赖青龙面板时，任何程序直接把通知 POST 到网关即可：

```bash
curl -X POST http://<IP>:18081/notify \
  -H 'Content-Type: application/json' \
  -d '{"title":"某任务","content":"执行失败 error 500"}'
```

网关 `extractText` 兼容常见字段别名：`title`/`subject`、`content`/`desp`/`message`/`text`/`body` 等；
也支持纯文本 body（`POST` 一段字符串当 content）。
青龙与本网关同机且同 docker 网络时可用容器名 `http://notify-router:8080/notify`，免开宿主端口。

## 配置存储与优先级

| 层 | 说明 |
|---|---|
| 环境变量 | 仅**首次启动播种**（首次无 config.json 时自动生成"企微/钉钉"两渠道），之后不再覆盖 |
| config.json | Web UI 保存后写入 `/app/config/config.json`（挂载卷），**重启后以此为准** |
| Web UI | 实时改、实时生效、写盘 |

## 环境变量一览

| 变量 | 默认 | 说明 |
|---|---|---|
| `QYWX_KEY` | 空 | 首次生成"企业微信"渠道用 |
| `DINGTALK_ACCESS_TOKEN` | 空 | 首次生成"钉钉"渠道用 |
| `DINGTALK_SECRET` | 空 | 钉钉加签密钥(以 `SEC` 开头) |
| `FALLBACK_ALL` | true | 无规则命中是否发全部启用渠道 |
| `LISTEN_PORT` | 8080 | 容器内监听端口 |
| `CONFIG_FILE` | /app/config/config.json | 配置持久化路径 |
| `GIST_TOKEN` | 空 | (可选)GitHub PAT(需 gist 权限)，配置后开启 Gist 云备份 |
| `GIST_ID` | 空 | (可选)同步目标的 Gist ID |
| `AUTH_USER` | 空 | (可选)Web 管理界面登录用户名。**与 `AUTH_PASS` 同时配置即开启登录鉴权** |
| `AUTH_PASS` | 空 | (可选)登录密码(也可用 `AUTH_PASSWORD`) |

> 除 `AUTH_*` 外的环境变量只在**服务首次播种**时生效。之后所有渠道/规则请在 Web UI 里配置（写盘持久化）。
> `AUTH_*` 是**每次启动实时读取**的：修改密码 = 在容器环境变量里改掉后重建/重启容器。

## 登录鉴权（v5.2.0+，强烈建议开启）

此前所有管理接口(`/api/config`、`/api/rules`、`/api/logs`……)都是无鉴权的——拿到地址就能读走企微 key、钉钉 secret 和全部通知正文。v5.2.0 起内置基于环境变量的账号登录：

### 开启方式（DPanel：容器 → 编辑 → 环境变量，加两条后重建）

```
AUTH_USER = admin          # 你的登录名
AUTH_PASS = 一个强密码      # 或 AUTH_PASSWORD
```

**两个都非空才启用**；只配一个或全不配 = 关闭鉴权（行为与旧版完全一致）。

### 生效后的行为

| 路径 | 是否需要登录 |
|---|---|
| `POST /notify`（脚本投递） | ❌ 永远公开，**青龙/脚本零改动** |
| `GET /health`（健康检查） | ❌ 永远公开 |
| `GET /`、`/ui`（页面外壳，不含任何配置数据） | ❌ 公开（登录遮罩在前端弹出） |
| 其余全部 `/api/*`（配置/渠道/规则/日志/导出/备份…） | ✅ 必须登录 |

- 登录成功下发 **HttpOnly + SameSite=Lax 会话 Cookie**，有效期 7 天（只存内存，容器重启后需重新登录）。
- 用户名/密码比较使用**常量时间比较**，登录失败固定延迟，防逐字节猜解。
- 打开页面时若未登录，全屏登录遮罩自动弹出；侧边栏左下角有「退出登录」按钮。

### 测试

```bash
npm test    # 含 test/auth.test.js: 真实起进程验证 401 闸门/登录/会话/注销, 以及 /notify 公开性
```

> 如果网关前面还有 Cloudflare/反代，建议**两者都做**：环境变量登录（本节）+ 反代层只放行 `/notify`、`/health`、`/`（双保险）。

## 隐私打码（v5.2.0+）

侧边栏左下角「收件地址」的域名**默认常驻模糊**（毛玻璃），截图、投屏、录屏不会泄露你的域名；

- **点击**地址 → 临时明文显示 **8 秒** → 自动恢复模糊；
- 8 秒内再次点击 → 立即恢复模糊；
- 鼠标悬停时模糊略微减轻，提示可点击。

该效果纯前端实现，对 `/notify` 接口与脚本投递无任何影响。

## 配置防丢：Gist 云端备份（强烈推荐配置）

DPanel 更新/重建容器时若卷被带走，`config.json` 会随卷消失。已内置三层保险：

1. **卷挂载** `notify-router-config → /app/config`（部署时确认）
2. **自动 .bak**：每次保存前自动备份上一份，主文件损坏启动时自动回退
3. **Gist 云备份**：配置 `GIST_TOKEN` + `GIST_ID` 环境变量后——
   - 启动时若本地无 `config.json`，**自动从 Gist 拉回**（卷丢了也不怕）
   - 每次 UI 保存后**自动推送**最新配置到 Gist
   - 「系统设置」页可查看备份状态、手动拉取/推送

### 配置步骤（5 分钟）

```
1. 生成 Token：GitHub → Settings → Developer settings → Personal access tokens (classic)
   → Generate new token → 只勾选 gist 权限即可
2. 创建 Gist：gist.github.com 新建一个私密(secret) Gist，
   文件名任意(如 notify-router-config.json)，内容可先放 {}
   → 从 URL 末尾拿到 Gist ID（如 https://gist.github.com/你的用户名/abcd1234 中的 abcd1234）
3. DPanel → 容器 → 编辑 → 环境变量，添加两条后重建容器：
   GIST_TOKEN = 第1步的 token
   GIST_ID    = 第2步的 Gist ID
4. 重建启动后：本地无配置 → 自动从 Gist 恢复；之后 UI 里每次保存都自动同步到云端
```

> Token 只存在容器环境变量里，不会写入 config.json、不会通过任何 API 返回给前端。

## 常见问题

- **宿主 8080 被占？** → 对外映射已是 `18081:8080`。要再改就改 `docker-compose.yml` 的 `ports`。
- **想加一个 Bark / Server酱 / Telegram / 飞书？** → 「渠道管理 → 新增 → 自定义Webhook」，填 URL + JSON/表单/文本模板即可，无需改代码。若平台要加自定义头（如 `Authorization`），在"额外请求头"里填 JSON。
- **想"某些失败任务才进钉钉，其余全发"？** → 加一条"包含失败 → 钉钉"规则即可；其余内容自动走"发全部"。若想更多层，多建几条规则（按顺序先命中先得）。
- **只想要某一条只发企微、绝不多发？** → 加规则命中它 → 只选企微；并把默认策略保持"发全部"，未命中普通通知才全发——若想未命中也别发，把默认策略关掉即可。
- **改了配置重启丢了？** → 确认容器挂载命名卷到 `/app/config`；并按上文配置 **Gist 云备份**，即使卷丢了重启也会自动从云端恢复。更新前也可在「系统设置 → 导出配置」手动下载一份 config.json 保底。
- **收到企微/钉钉通知"糊成一行"，正文里是字面的 `\n`？** → v5.1.2 起已修。原因：青龙各仓库共用的 `tools/sendNotify.js` 会把真实换行 `replaceAll('\n','\\n')` 成两字符再塞进请求体，本想让 JSON 合法，却被随后的 `JSON.stringify` 二次转义，对端再没人还原 → 长通知全挤成一行。网关现在会在入口把字面量 `\n` 还原为真换行（只还原 `\n`，不碰 `\t`，否则 `C:\temp` 这类路径会被改成制表符）。回归用例见 `test/notify-body.test.js`（`npm test`）。
- **忘了登录密码？** → 密码只存在容器环境变量 `AUTH_PASS` 里：DPanel → 容器 → 编辑 → 环境变量改成新值 → 重建容器即可。会话存内存，重启后所有已登录会话自然失效。
- **想让管理界面只能内网访问？** → 开启 `AUTH_USER/AUTH_PASS` 登录（见上文「登录鉴权」）；或在反代/防火墙层限制来源 IP。两层一起做最稳。
- **网关机器无 docker？** → `node src/server.js` 直接跑（需 Node ≥18）。

## 更新日志

- **v5.2.0**：新增容器环境变量登录鉴权（`AUTH_USER`/`AUTH_PASS`，管理接口全量 401 闸门 + HttpOnly 会话）；侧边栏收件地址常驻模糊打码、点击临时显示；`npm test` 新增鉴权端到端测试 `test/auth.test.js`。
- **v5.1.2**：还原发送端字面量 `\n` 转义，修复长通知在企微/钉钉糊成一行；新增全链路回归测试。
- **v5.1.1**：分流规则关键词兼容顿号/中文逗号等多种分隔符，并自动修复历史配置；转发日志落盘（最近 300 条）。
