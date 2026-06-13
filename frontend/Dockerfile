# 多阶段：node 里 build 前端 → caddy 托管静态产物。
# 好处：turing 上无需装 node，arch 一致（官方 multi-arch 基础镜像），dist 烤进镜像。
FROM node:20-alpine AS build
WORKDIR /app
# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm ci
# 再 build
COPY . .
RUN npm run build

# 托管阶段：Caddy 提供 SPA 静态 + 反代（Caddyfile 由 compose 挂载）
FROM caddy:2.8
COPY --from=build /app/dist /srv
