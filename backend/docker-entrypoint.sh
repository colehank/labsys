#!/bin/sh
# 容器启动：先迁移数据库到最新，再（幂等）灌种子数据，最后启动传入的命令。
# seed 幂等（按 email/存在性跳过），故每次启动都跑也安全。
set -e

echo "[entrypoint] alembic upgrade head"
uv run alembic upgrade head

echo "[entrypoint] seed（幂等，已存在则跳过）"
uv run python -m app.db.seed || echo "[entrypoint] seed 非致命失败，跳过"

echo "[entrypoint] exec: $*"
exec "$@"
