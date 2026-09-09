# notify-router — 通用通知分流网关（含 Web 管理界面）

一个**通用、可扩展**的通知分流网关：接收集群/脚本/任意程序的通知，**按你自己定义的规则**把不同内容分发到不同的通知渠道。内置企微、钉钉、PushPlus，并支持对接**任意自定义 Webhook**（Post/JSON 模板等）。

纯 Node 实现、**无第三方依赖**。带一个**多页面 Web 管理界面**（`http://<IP>:端口`），渠道、规则、兜底策略、界面美化全部**在线点鼠标配置**，保存即时生效并持久化，无需改环境变量重启。

## 核心能力（相比"只分两条通道"的大升级）

- **多渠道可插拔**：不只是企微+钉钉。支持 `wecom` / `dingtalk` / `pushplus` / `generic`(任意自定义 Webhook)，可加任意多个，各自独立启用/停用。
- **用户自定义规则**：规则按顺序匹配，每条规则可把内容送到**一个或多个渠道**。匹配方式支持：
  - `包含关键词`（子串）
  - `正则匹配`（忽略大小写）
  - `全部命中`（无条件，用作"剩余都走指定集合"的兜底）
- **无规则命中 → 默认发全部启用渠道**（可一键关闭为"不发送"）。
- **侧边栏多页面导航**：总览 / 发送投递 / 渠道管理 / 分流规则 / 转发日志 / 界面美化 / 系统设置，互不干扰。

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
│  ├─ server.js       # HTTP: /(UI多页)、/api/config、/api/channels、/api/rules、/api/test、
│  │                  #        /api/logs、/health、POST /notify
│  ├─ configStore.js  # 配置存储: channels[]/rules[] 规范化 + config.json 持久化 + 环境变量播种
│  ├─ router.js       # 规则引擎(纯逻辑): 遍历规则→首个命中定渠道; 否则全发
│  ├─ channels.js     # 渠道适配器注册表: wecom/dingtalk/pushplus/generic
│  ├─ log.js          # 内存环形转发日志
│  └─ ui.js           # 多页面 Web 管理界面(侧边栏导航)
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
- **总览**：启用渠道数、规则数、兜底策略、接入方式、渠道一览
- **发送投递**：模拟一条通知走网关，实时看它被分流到哪些渠道
- **渠道管理**：增删改渠道 + 一键启停 + 单渠道**连通性测试**。支持企微/钉钉/PushPlus/自定义Webhook
- **分流规则**：增删改规则，多选目标渠道；可设默认策略(无命中发全部/不发)
- **转发日志**：最近转发明细（模式、命中规则、投递渠道、正文），自动刷新
- **界面美化**：明暗主题、强调色、背景(渐变/纯色/上传图片)、压暗、圆角、自定义CSS，保存即持久
- **系统设置**：监听端口、配置来源、导出/重新载入配置

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

## 五、接入青龙（让脚本通知经过网关）

青龙原生"系统通知"企微通道 URL 固定指向 qyapi、改不了道，请走**脚本侧**接入：把签到脚本/仓库 `sendNotify` 里可自定义 webhook 的目标 URL 改成
`http://<小主机IP>:18081/notify`，网关收到后按你的规则二次分流。
> 青龙与本网关同机且同 docker 网络时，可直接用容器名 `http://notify-router:8080/notify`，免走宿主端口。

## 配置存储与优先级

| 层 | 说明 |
|---|---|
| 环境变量 | 仅**首次启动播种**（首次无 config.json 时自动生成"企微/钉钉"两渠道），之后不再覆盖 |
| config.json | Web UI 保存后写入 `/app/config/config.json`（挂载卷），**重启后以此为准** |
| Web UI | 实时改、实时生效、写盘 |

## 环境变量一览（仅播种用）

| 变量 | 默认 | 说明 |
|---|---|---|
| `QYWX_KEY` | 空 | 首次生成"企业微信"渠道用 |
| `DINGTALK_ACCESS_TOKEN` | 空 | 首次生成"钉钉"渠道用 |
| `DINGTALK_SECRET` | 空 | 钉钉加签密钥(以 `SEC` 开头) |
| `FALLBACK_ALL` | true | 无规则命中是否发全部启用渠道 |
| `LISTEN_PORT` | 8080 | 容器内监听端口 |
| `CONFIG_FILE` | /app/config/config.json | 配置持久化路径 |

> 环境变量只在**服务端首次播种**。之后所有渠道/规则请在 Web UI 里配置（写盘持久化），不必依赖环境变量。

## 常见问题

- **宿主 8080 被占？** → 对外映射已是 `18081:8080`。要再改就改 `docker-compose.yml` 的 `ports`。
- **想加一个 Bark / Server酱 / Telegram / 飞书？** → 「渠道管理 → 新增 → 自定义Webhook」，填 URL + JSON/表单/文本模板即可，无需改代码。若平台要加自定义头（如 `Authorization`），在"额外请求头"里填 JSON。
- **想"某些失败任务才进钉钉，其余全发"？** → 加一条"包含失败 → 钉钉"规则即可；其余内容自动走"发全部"。若想更多层，多建几条规则（按顺序先命中先得）。
- **只想要某一条只发企微、绝不多发？** → 加规则命中它 → 只选企微；并把默认策略保持"发全部"，未命中普通通知才全发——若想未命中也别发，把默认策略关掉即可。
- **改了配置重启丢了？** → 确认容器挂载命名卷到 `/app/config`。
- **网关机器无 docker？** → `node src/server.js` 直接跑（需 Node ≥18）。
