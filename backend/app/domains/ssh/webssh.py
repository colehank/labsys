"""WebSSH —— 浏览器 xterm.js ↔ FastAPI WebSocket ↔ AsyncSSH PTY 实时双向流。

设计原则（重要）：网页终端 = **用户本人的 SSH 会话**，凭据由用户自己输入。
后端只做 PTY↔WebSocket 的透传管道，绝不持有/使用任何 root/labadmin 凭据。

鉴权两层：
  1. JWT（查询参数，WS 无法带 Authorization 头）——确认是已登录的 labsys 用户，才放行建连。
  2. SSH 本身——用客户端首帧握手里送来的「账号+密码」连接目标机，权限完全等同用户本人。

协议：
  - 首帧：JSON 文本 `{"username","password","cols","rows"}` —— 用于建立 SSH 连接。
  - 之后：纯文本 = 键盘输入透传给 PTY；JSON `{"type":"resize","cols","rows"}` = 改窗口大小。
  - 服务端→客户端：PTY 原始输出透传；建连/错误以普通文本回送（含 \r\n）。

⚠️ 需真实可达目标机 + 用户在该机的账号才能 E2E；应用须运行在能直连目标机的内网主机上。
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.db import SessionLocal
from app.core.security import decode_token
from app.models import Server, User

router = APIRouter(tags=["webssh"])


@router.websocket("/ws/ssh/{server_id}")
async def webssh(ws: WebSocket, server_id: str, token: str = "") -> None:
    await ws.accept()

    # ── 第一层：JWT 鉴权（确认是合法 labsys 用户）──
    try:
        payload = decode_token(token, expect="access")
    except JWTError:
        await ws.send_text("\r\n[认证失败] 无效或过期的令牌。\r\n")
        await ws.close()
        return

    async with SessionLocal() as db:
        user = await db.get(User, payload.get("sub"))
        server = await db.get(Server, server_id)
    if user is None or server is None:
        await ws.send_text("\r\n[错误] 用户或服务器不存在。\r\n")
        await ws.close()
        return

    # ── 握手帧：拿到用户自己的 SSH 账号+密码 ──
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=120)
        hs = json.loads(raw)
        ssh_user = str(hs["username"]).strip()
        ssh_pass = str(hs.get("password", ""))
        cols = int(hs.get("cols", 80))
        rows = int(hs.get("rows", 24))
    except (asyncio.TimeoutError, json.JSONDecodeError, KeyError, TypeError, ValueError):
        await ws.send_text("\r\n[错误] 握手失败：需先发送 {username,password} 帧。\r\n")
        await ws.close()
        return
    if not ssh_user:
        await ws.send_text("\r\n[错误] 账号不能为空。\r\n")
        await ws.close()
        return

    import asyncssh  # 延迟导入，避免无依赖时影响其余路由

    # ── 第二层：用用户本人凭据连接目标机 ──
    try:
        conn = await asyncssh.connect(
            server.ip, port=server.ssh_port, username=ssh_user, password=ssh_pass,
            known_hosts=None,   # 内网受信主机；如需校验可改为指定 known_hosts 文件
        )
    except asyncssh.PermissionDenied:
        await ws.send_text(f"\r\n[认证失败] {ssh_user}@{server.name} 账号或密码错误。\r\n")
        await ws.close()
        return
    except Exception as exc:  # noqa: BLE001 —— 任何连接失败都回送给终端并关闭
        await ws.send_text(f"\r\n[连接失败] {server.name}({server.ip}:{server.ssh_port}): {exc}\r\n")
        await ws.send_text("（请确认应用运行在可直连该目标机的内网主机上）\r\n")
        await ws.close()
        return

    async with conn:
        proc = await conn.create_process(
            term_type="xterm-256color", term_size=(cols, rows),
        )

        async def pump_out() -> None:
            try:
                while not proc.stdout.at_eof():
                    data = await proc.stdout.read(4096)
                    if data:
                        await ws.send_text(data)
            except Exception:  # noqa: BLE001
                pass
            finally:
                # PTY 结束（exit / 连接断）时主动关闭 WS，避免前端悬挂
                try:
                    await ws.close()
                except Exception:  # noqa: BLE001
                    pass

        out_task = asyncio.create_task(pump_out())
        try:
            while True:
                msg = await ws.receive_text()
                # JSON 控制帧（窗口大小）走单独分支，其余皆视为键盘输入
                if msg and msg[0] == "{":
                    try:
                        ctl = json.loads(msg)
                    except json.JSONDecodeError:
                        ctl = None
                    if ctl and ctl.get("type") == "resize":
                        proc.change_terminal_size(int(ctl.get("cols", cols)), int(ctl.get("rows", rows)))
                        continue
                proc.stdin.write(msg)
        except WebSocketDisconnect:
            pass
        except Exception:  # noqa: BLE001
            pass
        finally:
            out_task.cancel()
            proc.close()
