# 多阶段：base 用官方 multi-arch python，靠 uv.lock 锁依赖 → arm64/amd64 行为一致
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
RUN pip install --no-cache-dir uv
WORKDIR /app

# 先装依赖（利用层缓存）
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev

# 腾讯会议预约需要 Chromium（Playwright）。--with-deps 装系统库，multi-arch 一致。
# 不需要预约功能可删此行以瘦身镜像（运行时未配 BOOKING 凭据则该功能自动禁用）。
RUN uv run playwright install --with-deps chromium

# 再拷代码
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000
# entrypoint 先迁移+seed，再 exec CMD（dev override 会把 CMD 换成带 --reload 的）
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
