# notify-router

> 通用通知分流网关 —— 接收集群 / 脚本 / 任意程序的通知，**按你自定义的规则**把不同内容分发到不同渠道。

纯 Node 实现、**零第三方依赖**，自带一个**多页面 Web 管理界面**：渠道、规则、兜底策略、界面美化全部在线点鼠标配置，保存即生效并落盘，无需改环境变量重启。

```
任意来源通知 ──POST /notify──▶ notify-router
                                   │  依次遍历你的规则
                                   ├─ 命中规则1(如 含"失败") → 发到 规则1 指定的渠道(可多个)
                                   ├─ 命中规则2(...)         → 发到 规则2 指定渠道
                                   └─ 无任何规则命中          → 默认发全部启用渠道
```

---

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [Web 管理界面](#web-管理界面)
- [通知渠道](#通知渠道)
- [分流规则](#分流规则)
- [环境变量](#环境变量)
- [接入青龙面板](#接入青龙面板)
- [安全](#安全)
- [配置持久化与备份](#配置持久化与备份)
- [HTTP 接口](#http-接口)
- [项目结构](#项目结构)
- [开发与测试](#开发与测试)
- [常见问题](#常见问题)
- [更新日志](#更新日志)

---

## 特性

| 能力 | 说明 |
|---|---|
| **多渠道可插拔** | 不只是企微 + 钉钉。内置 `wecom` / `dingtalk` / `pushplus` / `generic`（任意自定义 Webhook），可加任意多个，各自独立启停 |
| **用户自定义规则** | 规则按顺序匹配，**首个命中即定渠道**；每条规则可同时投给多个渠道。支持 `包含关键词` / `正则匹配` / `全部命中` |
| **兜底策略** | 无任何规则命中时，默认**发全部启用渠道**，可一键改为"不发" |
| **登录鉴权** | 配置 `AUTH_USER` + `AUTH_PASS` 两个环境变量即开启 Web 界面登录；`/notify`、`/health` 永远公开，**脚本投递零改动** |
| **隐私打码** | 侧边栏的收件地址**常驻模糊**，点击才临时明文显示（8 秒后自动恢复），截图 / 投屏不泄露域名 |
| **多页面导航** | 总览 / 发送投递 / 渠道管理 / 分流规则 / 转发日志 / 界面美化 / 系统设置，互不干扰 |
| **界面可定制** | 明暗主题 / 强调色 / 渐变·纯色·图片背景 / 卡片圆角 / 自定义 CSS；背景可选「全屏」或「仅内容区」；桌面端侧栏可收起（状态记忆） |
| **轻量省资源** | 零第三方依赖 + `node:20-alpine` 镜像（约 60MB）；UI 单页内联、gzip 传输（约 23KB），无数据库、无后台任务常驻 |
| **配置可随身带走** | 一键**导出 / 导入**整个 `config.json`；每次保存自动写 `.bak`，主文件损坏时启动自动回退 |
| **内置升级检测** | 一键查询远端镜像最新 digest，核对部署机器上是否已是最新版 |

---

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
git clone <本仓库地址> notify-router && cd notify-router
cp .env.example .env      # 填入自己的凭据; .env 已被 .gitignore 忽略, 不会入库
docker compose up -d --build
```

打开 `http://<服务器IP>:18081` 即为管理界面。

> **凭据请写在 `.env` 里，不要写进 `docker-compose.yml`。** 仓库里的 compose 只保留空占位符，避免密钥跟着 git 一起泄露。

### 方式二：面板部署（DPanel 等，全程点鼠标）

1. 打开面板 UI → **「镜像」→「构建」→ 本地上传 ZIP** → 镜像名填 `notify-router:latest` → 构建
2. **「容器」→「创建」**：
   - 镜像 `notify-router:latest`
   - **端口映射**：主机 `18081` → 容器 `8080`（若宿主 8080 空闲，也可用 `8080:8080`）
   - **挂载命名卷**到容器 `/app/config`（保存 UI 里的渠道 / 规则，重启不丢）
   - **环境变量**只作首次播种，可留空后到 UI 里配

> 构建时若拉 `node:20-alpine` 慢，可把 `Dockerfile` 首行换成加速源：`FROM docker.1ms.run/library/node:20-alpine`。不想本地构建也可以直接拉 CI 预构建镜像，见[方式三](#方式三拉取预构建镜像免本地构建)；面板里拉镜像卡住同样适用镜像站方案。

### 方式三：拉取预构建镜像（免本地构建）

仓库 push 后 CI 会自动构建多架构镜像并发布到 ghcr，直接拉取即可：

```bash
docker pull ghcr.io/<仓库所有者>/notify-router:latest

docker run -d --name notify-router \
  --restart unless-stopped \
  -p 18081:8080 \
  -e LISTEN_PORT=8080 \
  -e AUTH_USER=admin \
  -e AUTH_PASS='改成你的登录密码' \
  -e FALLBACK_ALL=true \
  -v notify-router-config:/app/config \
  --memory 128m --cpus 0.5 \
  ghcr.io/<仓库所有者>/notify-router:latest
```

**拉取慢 / 卡住（境内服务器常见）？** ghcr.io 在国内直连常掉到 KB 级甚至挂起，此时改用南京大学镜像站（匿名可用，与官方镜像内容一致）：

```bash
# 1. 换镜像站拉取
docker pull ghcr.nju.edu.cn/<仓库所有者>/notify-router:latest

# 2. 改回标准名（compose / 容器引用不用变）
docker tag ghcr.nju.edu.cn/<仓库所有者>/notify-router:latest \
           ghcr.io/<仓库所有者>/notify-router:latest

# 3. 按上面的 docker run 或 compose 重建容器（卷不动, 配置不丢）
```

镜像站失效时备用思路：给 Docker daemon 配 HTTP 代理，或用「方式一」在服务器上直接 build（无第三方依赖，构建很快）。

### 方式四：不用 Docker

```bash
node src/server.js     # 需 Node ≥ 18, 会在本地生成 config.json
```

健康检查：`curl http://<服务器IP>:18081/health`

### 验证一下

```bash
BASE=http://127.0.0.1:18081

# 假设 UI 里配过"含失败 → 钉钉"规则: 这条应只发钉钉
curl -X POST $BASE/notify -H 'Content-Type: application/json' \
  -d '{"title":"某任务执行","content":"任务执行失败: 接口返回 error 500"}'

# 普通内容 → 无规则命中, 走兜底(发全部启用渠道)
curl -X POST $BASE/notify -H 'Content-Type: application/json' \
  -d '{"title":"每日签到","content":"本次共执行 12 个任务, 全部成功"}'
```

返回 `results[]` 会逐渠道给出 ok / error。也可以在界面「发送投递」页点着测，更直观。

---

## Web 管理界面

访问 `http://<服务器IP>:18081`，左侧多页面导航：

| 页面 | 用途 |
|---|---|
| **登录** | 配了 `AUTH_USER`/`AUTH_PASS` 时，打开即弹登录遮罩 |
| **总览** | 启用渠道数、规则数、兜底策略、接入方式、渠道一览 |
| **发送投递** | 模拟一条通知走网关，实时看它被分流到哪些渠道 |
| **渠道管理** | 增删改渠道 + 一键启停 + 单渠道**连通性测试** |
| **分流规则** | 增删改规则、多选目标渠道、设置默认策略 |
| **转发日志** | 最近转发明细（模式、命中规则、投递渠道、正文），自动刷新，落盘保留 300 条 |
| **界面美化** | 明暗主题、强调色、背景、圆角、自定义 CSS，保存即持久 |
| **系统设置** | 监听端口、配置来源、导出 / 导入配置、当前版本、检测升级 |

**收件地址（供脚本 POST）**：`http://<服务器IP>:18081/notify`

---

## 通知渠道

在「渠道管理 → 新增」里选择类型：

| 类型 | 填什么 |
|---|---|
| `wecom` | 企业微信群机器人 webhook 的 **key**（即 `...?key=` 后面那段） |
| `dingtalk` | 钉钉群机器人 **access_token** + **加签 secret**（以 `SEC` 开头） |
| `pushplus` | PushPlus 的 **token**，接口地址默认 `https://www.pushplus.plus/send` |
| `generic` | 任意 Webhook：`method` / `url` / `contentType` / `headers` / `bodyTemplate` |

`generic` 的 `bodyTemplate` 支持占位符 **`{{title}}`** 与 **`{{content}}`**；`contentType` 可选 `json` / `form` / `raw`，选 `raw` 时模板就是纯文本正文。这样几乎任何通知 API（Bark、Server酱、Telegram、飞书、自建接口……）都能接进来。

需要自定义请求头（如 `Authorization`）时，在「额外请求头」里填 JSON。

### 配置数据长这样

```jsonc
{
  "channels": [
    { "id":"wecom-main", "name":"企业微信主群", "type":"wecom",    "enabled":true,
      "cfg": { "key": "..." } },
    { "id":"ding-ops",   "name":"钉钉运维群",   "type":"dingtalk", "enabled":true,
      "cfg": { "accessToken":"...", "secret":"SEC..." } },
    { "id":"push-plus",  "name":"PushPlus",     "type":"pushplus", "enabled":false,
      "cfg": { "token":"...", "baseUrl":"https://www.pushplus.plus/send" } },
    { "id":"my-api",     "name":"自建接口",      "type":"generic",  "enabled":false,
      "cfg": { "method":"POST", "url":"https://...", "contentType":"json", "headers":{},
               "bodyTemplate":"{\"title\":\"{{title}}\",\"content\":\"{{content}}\"}" } }
  ],
  "rules": [
    { "id":"r1", "name":"失败→钉钉",   "match":"contains", "keyword":"失败、失效、error",
      "channels":["ding-ops"] },
    { "id":"r2", "name":"签到成功→企微", "match":"regex",    "pattern":"签到.*成功",
      "channels":["wecom-main"] }
  ],
  "fallbackAll": true,   // 无规则命中时: true=发全部启用渠道; false=不发
  "listenPort": 8080,
  "ui": { /* 界面美化 */ }
}
```

---

## 分流规则

规则**从上到下依次求值，首个命中就定渠道，不再继续匹配**；全部未命中才走兜底策略。

| 匹配方式 | 语义 |
|---|---|
| `包含关键词`（contains） | 子串匹配，忽略大小写。**一条规则可写多个关键词，命中任意一个即匹配** |
| `正则匹配`（regex） | 正则表达式，忽略大小写 |
| `全部命中`（all） | 无条件命中，用作"剩余都走这个渠道集合"的兜底规则 |

一条规则的 `channels` 可以选**多个**渠道，命中后同时投递。

### 关键词分隔符（踩过的坑）

多个关键词的分隔符支持英文逗号 `,`、中文逗号 `，`、顿号 `、`、分号 `;`：

```
失败、失效、error     → 3 个关键词: 失败 / 失效 / error
失败, error, 异常     → 3 个关键词
```

> ⚠️ 老版本只认逗号。用顿号写的 `失败、失效、error` 会被当成**一整个关键词**去匹配正文，永远命中不了 → 规则静默失效、通知掉到兜底。**v5.1.1 起已兼容顿号并自动修复历史配置**。新增 / 编辑规则时，弹窗下方会实时显示"将按 N 个关键词「或」匹配"，可当场核对。

### 例子

- **包含 "失败" → 只发钉钉**；其余普通通知走兜底 → 发全部启用渠道
- **只想要某条通知必定走企微、绝不多发**：加一条规则命中它、只勾企微；兜底策略保持"发全部"

### 排查

分流没生效时，进「转发日志」看每条记录的 `规则命中 / 默认(发全部)` 标记与目标渠道。

---

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `AUTH_USER` | 空 | Web 界面登录用户名。**与 `AUTH_PASS` 同时配置即开启登录鉴权** |
| `AUTH_PASS` | 空 | 登录密码（也可用 `AUTH_PASSWORD`） |
| `QYWX_KEY` | 空 | 首次播种"企业微信"渠道用 |
| `DINGTALK_ACCESS_TOKEN` | 空 | 首次播种"钉钉"渠道用 |
| `DINGTALK_SECRET` | 空 | 钉钉加签密钥（以 `SEC` 开头） |
| `FALLBACK_ALL` | `true` | 无规则命中是否发全部启用渠道 |
| `LISTEN_PORT` | `8080` | 容器内监听端口 |
| `CONFIG_FILE` | `/app/config/config.json` | 配置持久化路径 |
| `GIST_TOKEN` | 空 | （可选）GitHub PAT（需 gist 权限），配置后开启 Gist 云备份 |
| `GIST_ID` | 空 | （可选）同步目标的 Gist ID |
| `UPGRADE_REPO` | 本仓库 | （可选）「检测升级」查询的镜像仓库，fork 后指向自己的 |

> - 除 `AUTH_*` 外的环境变量只在**首次播种**时生效（首次启动且尚无 `config.json`）。之后所有渠道 / 规则请在 Web UI 里配。
> - `AUTH_*` 是**每次启动实时读取**的：改密码 = 改环境变量后重建 / 重启容器。
> - 本地部署建议写进 `.env`（见 `.env.example`），**不要把真实凭据提交进 Git**。

---

## 接入青龙面板

### 5.1 青龙侧：新增一个「自定义通知（Webhook）」

青龙较新版本（≥ v2.13，含 v2.20.x）的 **系统设置 → 通知设置** 自带「自定义通知（Webhook）」渠道。把它指向网关的 `POST /notify` 即可，**不需要改任何脚本 / sendNotify.js**：青龙每次任务结束自动调它 → 通知进网关 → 按你的规则分流。

在青龙 **系统设置 → 通知设置** 里新增 / 切换为该方式，填 5 个字段：

| 青龙字段 | 填什么 |
|---|---|
| `webhookMethod` | `POST` |
| `webhookContentType` | `application/json` |
| `webhookUrl` | 见 [5.2](#52-webhookurl-填哪个地址) |
| `webhookHeaders` | `Content-Type: application/json`（单行即可） |
| `webhookBody` | 两行（青龙按多行 `key: value` 自动转成 JSON POST）：<br>`title: $title`<br>`content: $content` |

保存后青龙会把每条通知包装成 `{"title":"任务标题","content":"日志/详情", ...}` POST 到网关；网关自动取 `title` + `content`，再按规则分流。

> `webhookBody` 里的占位符是 **`$title` / `$content`**（不是 `{{title}}`），且必须是上面这种**多行 `键: 值`** 写法。写成一行 JSON（`{"title":"$title",...}`）会被青龙的解析器当成 0 个字段，**通知内容全丢且不报错**。

### 5.2 webhookUrl 填哪个地址

青龙跑在容器里，要选一个**青龙容器内能访问到** notify-router 的地址：

| # | 地址 | 适用场景 |
|---|---|---|
| 1 | `http://<宿主机IP>:18081/notify` | **首选**，最通用。例：`http://10.0.0.5:18081/notify` |
| 2 | `http://notify-router:8080/notify` | 仅当青龙与网关**在同一 docker 网络** |

**怎么确认哪个通**：进宿主机终端跑一句

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"title":"ping","content":"test"}' http://<宿主机IP>:18081/notify
# 返回 {"ok":true,...} → 这个地址可用
```

> ⚠️ **不要填公网域名。** 如果网关前面挂着 Cloudflare 之类的 CDN，`/health` 看着正常（返回 200），但脚本用的 Node/Python 默认 UA 会被 CDN 拦成 **403**，表现为"通知发不出去、但网关像是好的"。实测容器内走内网 IP 只要几毫秒，走域名要一两秒且可能被拦。

### 5.3 青龙通知的两种粒度

青龙有**两个互相独立**的通知入口，改一个不会影响另一个：

| 入口 | 来源 | 是否经网关 |
|---|---|---|
| **① 系统通知** | 青龙 → 系统设置 → 通知设置（含上面配的自定义通知） | ✅ 走网关 |
| **② 脚本 sendNotify** | 各脚本仓库自带的 `sendNotify.js`，读的是**进程环境变量** | ❌ 仍直发官方接口 |

- **推荐**：① 接好网关后，在青龙通知设置里**取消勾选 / 移除原来的企微、钉钉等官方渠道**，只留「自定义通知」→ 所有系统通知统一进网关。
- **入口 ②** 常见的坑：某些青龙面板会在 `/ql/data/config/config.sh` 里导出 `QYWX_KEY` 等变量，而该文件被**每个任务启动时 source**，于是所有脚本都拿到了官方渠道凭据、径直绕过网关。想收口入口 ②，把 `config.sh` 里的官方 key 清空、并给脚本侧配置指向网关的 Webhook 变量即可（`config.sh` 不在 `repo/` 目录下，`ql repo` 不会覆盖它）。

### 5.4 任意程序接入

不依赖青龙面板时，任何程序直接把通知 POST 到网关：

```bash
curl -X POST http://<服务器IP>:18081/notify \
  -H 'Content-Type: application/json' \
  -d '{"title":"某任务","content":"执行失败 error 500"}'
```

网关兼容常见字段别名：`title`/`subject`、`content`/`desp`/`message`/`text`/`body` 等；也支持纯文本 body（直接 POST 一段字符串当 content）。

---

## 安全

### 登录鉴权

早期版本所有管理接口都是无鉴权的——拿到地址就能读走企微 key、钉钉 secret 和全部通知正文。现在内置基于环境变量的账号登录：

```
AUTH_USER = admin          # 用户名
AUTH_PASS = 一个强密码      # 或 AUTH_PASSWORD
```

**两个都非空才启用**；只配一个或都不配 = 关闭鉴权（行为与旧版一致）。

| 路径 | 是否需要登录 |
|---|---|
| `POST /notify`（脚本投递） | ❌ 永远公开，**青龙 / 脚本零改动** |
| `GET /health`（健康检查） | ❌ 永远公开 |
| `GET /`、`/ui`（页面外壳，不含任何配置数据） | ❌ 公开（登录遮罩由前端弹出） |
| 其余全部 `/api/*`（配置 / 渠道 / 规则 / 日志 / 导出 / 备份…） | ✅ 必须登录 |

- 登录成功下发 **HttpOnly + SameSite=Lax 会话 Cookie**，有效期 7 天（只存内存，容器重启后需重新登录）。
- 用户名 / 密码用**常量时间比较**，登录失败有固定延迟，防逐字节猜解。

### 隐私打码

侧边栏「收件地址」的域名**默认常驻模糊**（毛玻璃），截图 / 投屏 / 录屏不会泄露；点击才临时明文显示 **8 秒**，期间再点一下立即恢复。纯前端实现，对 `/notify` 接口与脚本投递无任何影响。

### 部署建议

如果网关前面还有 Cloudflare / 反向代理，建议**两层都做**：环境变量登录（上面）+ 反代层只放行 `/notify`、`/health`、`/`。管理接口只在内网可达最稳。

### 凭据卫生

- 凭据写进 `.env`（已 gitignore）或面板的环境变量，**不要提交进 Git**。
- 一旦怀疑泄露：到企微 / 钉钉群机器人设置里**重置** webhook key、access_token 与加签 secret —— 明文进过版本库的凭据都应视为已泄露，改完再更新本地 `.env`。

---

## 配置持久化与备份

配置存在挂载卷的 `/app/config/config.json`。容器更新 / 重建时若卷被带走，配置会消失，因此内置三层保险：

1. **卷挂载**：`notify-router-config → /app/config`（部署时确认）
2. **自动 `.bak`**：每次保存前备份上一份；启动时主文件若损坏，自动用 `.bak` 回退，不会因写一半崩溃而丢光
3. **Gist 云备份**（可选）：配 `GIST_TOKEN` + `GIST_ID` 后
   - 启动时本地无 `config.json` → **自动从 Gist 拉回**（卷丢了也不怕）
   - 每次 UI 保存后 → **自动推送**到 Gist
   - 「系统设置」页可查看备份状态、手动拉取 / 推送

### Gist 备份配置（5 分钟）

1. 生成 Token：GitHub → Settings → Developer settings → Personal access tokens (classic) → Generate new token → **只勾选 `gist` 权限**
2. 新建一个**私密（secret）** Gist，文件名任意（如 `notify-router-config.json`），内容可先放 `{}` → 从 URL 末尾拿到 Gist ID（`https://gist.github.com/<用户名>/<这一串>`）
3. 把 `GIST_TOKEN` / `GIST_ID` 加进环境变量（或 `.env`）后重建容器
4. 启动后：本地无配置 → 自动从 Gist 恢复；之后每次保存自动同步

> Token 只存在容器环境变量里，不会写入 `config.json`，也不会通过任何 API 返回给前端。

也可以用「系统设置 → 导出配置」手动下载一份 `config.json` 保底。

---

## HTTP 接口

| 方法 | 路径 | 说明 | 需登录 |
|---|---|---|---|
| `POST` | `/notify` | **接收通知**（脚本投递入口） | ❌ |
| `GET` | `/health` | 健康检查 / 渠道概览 | ❌ |
| `GET` | `/`、`/ui` | Web 管理界面 | ❌ |
| `GET` | `/api/session` | 当前登录状态（前端启动时探测） | ❌ |
| `POST` | `/api/login` | 登录 | ❌ |
| `POST` | `/api/logout` | 注销 | ❌ |
| `GET` | `/api/meta` | 渠道类型等元信息 | ✅ |
| `GET` | `/api/config` | 读取完整配置 | ✅ |
| `GET` | `/api/config/export` | 导出配置（下载原文） | ✅ |
| `POST` | `/api/config/import` | 导入配置（覆盖） | ✅ |
| `GET`/`POST` | `/api/channels` | 渠道列表 / 新增 | ✅ |
| `PUT`/`DELETE` | `/api/channels/:id` | 修改 / 删除渠道 | ✅ |
| `GET`/`POST` | `/api/rules` | 规则列表 / 新增 | ✅ |
| `PUT`/`DELETE` | `/api/rules/:id` | 修改 / 删除规则 | ✅ |
| `POST` | `/api/test` | 用真实渠道发送一条测试通知 | ✅ |
| `GET` | `/api/logs` | 转发日志（保留最近 300 条） | ✅ |
| `POST` | `/api/logs/clear` | 清空日志 | ✅ |
| `GET` | `/api/version` | 当前版本 | ✅ |
| `GET` | `/api/upgrade-check` | 查询远端镜像最新 digest | ✅ |
| `GET` | `/api/backup/status` | Gist 备份状态 | ✅ |
| `POST` | `/api/backup/pull` / `push` | 手动拉取 / 推送配置 | ✅ |

---

## 项目结构

```
notify-router/
├─ src/
│  ├─ server.js       # HTTP 路由 + 登录鉴权闸门 + /notify 投递
│  ├─ configStore.js  # 配置存储: 规范化 + 持久化 + .bak 备份/回退 + 环境变量播种
│  ├─ router.js       # 规则引擎(纯逻辑): 遍历规则→首个命中定渠道; 否则全发
│  ├─ channels.js     # 渠道适配器: wecom / dingtalk / pushplus / generic
│  ├─ log.js          # 环形转发日志(落盘最近 300 条)
│  └─ ui.js           # 多页面 Web 管理界面(侧边栏导航 / 登录遮罩 / 地址打码)
├─ test/
│  ├─ notify-body.test.js  # 通知正文换行还原回归测试(复刻发送端组包→网关解析全链路)
│  └─ auth.test.js         # 登录鉴权端到端测试(真实起进程: 401 闸门 / 登录 / 会话 / 注销)
├─ .github/workflows/docker-publish.yml   # push 自动构建多架构镜像并推送到 ghcr.io
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
├─ package.json
└─ README.md
```

---

## 开发与测试

```bash
npm test          # 跑全部回归测试(无需安装依赖, 用 node:test 风格的自建断言)
node src/server.js   # 本地起服务
```

测试都是**真实起进程 + 真实 HTTP 请求**的端到端风格，包含：

- `test/notify-body.test.js` — 逐字复刻「发送端组包 → 网关解析」整条链路，含「先复现故障、再验证修复」的对照
- `test/auth.test.js` — 401 闸门、公开端点、登录、会话放行、伪造令牌、注销

---

## 常见问题

- **宿主 8080 被占？** → 对外映射改成 `18081:8080`（本项目默认）。要再改就改 `docker-compose.yml` 的 `ports`。
- **想加 Bark / Server酱 / Telegram / 飞书？** → 「渠道管理 → 新增 → 自定义 Webhook」，填 URL + JSON / 表单 / 文本模板，无需改代码。要加自定义头（如 `Authorization`）就填「额外请求头」JSON。
- **想"失败任务才进钉钉，其余全发"？** → 加一条「包含失败 → 钉钉」规则；其余走兜底"发全部"。要更多层级就多建几条（按顺序先命中先得）。
- **改了配置重启丢了？** → 确认容器挂了命名卷到 `/app/config`；并按上文配 **Gist 云备份**。更新前也可「系统设置 → 导出配置」下载一份保底。
- **通知"糊成一行"、正文里能看到字面的 `\n`？** → v5.1.2 起已修。原因：部分脚本仓库共用的 `sendNotify.js` 会把真实换行 `replaceAll('\n','\\n')` 成两个字符再塞进请求体，本想让 JSON 合法，却被随后的 `JSON.stringify` 二次转义，对端再没人还原 → 长通知全挤成一行。网关现在会在入口把字面量 `\n` 还原为真换行（**只还原 `\n`**，不碰 `\t`，否则 `C:\temp` 这类路径会被改成制表符）。回归用例见 `test/notify-body.test.js`。
- **忘了登录密码？** → 密码只存在环境变量 `AUTH_PASS` 里：改掉后重建容器即可（会话存内存，重启后旧会话自然失效）。
- **想让管理界面只能内网访问？** → 开启 `AUTH_USER`/`AUTH_PASS`，或在反代 / 防火墙层限制来源 IP。两层一起做最稳。
- **填写地址时 `curl` 能通、脚本却发不出去？** → 多半是走了公网域名被 CDN 拦 UA（403）。改用内网 IP，见 [5.2](#52-webhookurl-填哪个地址)。
- **面板/命令行拉 ghcr 镜像一直卡在 0%？** → 境内直连 ghcr.io 的通病。停掉当前拉取，换 `ghcr.nju.edu.cn/<仓库所有者>/notify-router:latest`拉取后 `docker tag` 改回标准名，见[方式三](#方式三拉取预构建镜像免本地构建)。
- **DPanel 点「重新部署」但版本一直没变？** → 重新部署只是用**本地已有镜像**重建容器，不会主动拉新 latest。更新套路固定为：先 `docker pull`（或 compose pull）拿到新镜像，再重建容器。
- **网关机器没装 docker？** → `node src/server.js` 直接跑（需 Node ≥ 18）。

---

## 更新日志

- **v5.3.0**：界面与体积双优化。新增**favicon 浏览器标签图标**（内联 SVG「分流」图标，同时替换品牌位 50KB base64 JPEG，UI 体积 -45%）；管理界面 UI 渲染**缓存 + gzip**（传输 74KB → 23KB）；桌面端**侧栏可收起**（右上 ☰ 按钮，状态记忆）；「界面美化」新增**背景范围**设置（全屏 / 仅内容区——背景只填充侧栏外空白区域，解决背景被侧栏遮挡的问题）；Dockerfile 换 `node:20-alpine`（镜像 -50MB），compose 加 `mem_limit: 128m` / `cpus: 0.5` 资源上限。
- **v5.2.1**：仓库卫生与文档重构。`docker-compose.yml` 改为空占位符 + `.env` 变量注入，新增 `.env.example` 并把 `.env` 加入 `.gitignore`/`.dockerignore`，避免凭据随 git 泄露；「检测升级」目标仓库改为可用环境变量 `UPGRADE_REPO` 覆盖（便于 fork）；README 重新排版。
- **v5.2.0**：新增环境变量登录鉴权（`AUTH_USER`/`AUTH_PASS`，管理接口全量 401 闸门 + HttpOnly 会话）；侧边栏收件地址常驻模糊打码、点击临时显示；`npm test` 新增鉴权端到端测试 `test/auth.test.js`。
- **v5.1.2**：还原发送端字面量 `\n` 转义，修复长通知在企微 / 钉钉糊成一行；新增全链路回归测试。
- **v5.1.1**：分流规则关键词兼容顿号 / 中文逗号等多种分隔符，并自动修复历史配置；转发日志落盘（最近 300 条）。

---

## 许可证

[MIT](LICENSE) © 2026 notify-router contributors
