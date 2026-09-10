# notify-router — 青龙通知分流网关 (含 Web 管理界面)
# 无第三方依赖, 用官方 node:alpine 即可(比 slim 再小 ~50MB)
FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src

# 配置持久化目录(Web UI 修改配置写入此文件, 需可写; 用命名卷/挂载目录映射)
RUN mkdir -p /app/config
ENV NODE_ENV=production
ENV CONFIG_FILE=/app/config/config.json
ENV LISTEN_PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
