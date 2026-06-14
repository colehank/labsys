"""邮件发送 —— 校园 SMTP（aiosmtplib）。

凭据从 settings 注入。设计为 **尽力而为**：任何失败只记日志、返回 False，
绝不抛异常打断业务动作（审批/开通账号等不能因为邮件挂了而失败）。
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from email.utils import formataddr

import aiosmtplib

from app.core.config import settings

log = logging.getLogger("cibol.mail")


async def send_email(
    to: str,
    subject: str,
    text: str,
    *,
    html: str | None = None,
    timeout: float = 15.0,
) -> bool:
    """发一封纯文本（可选 HTML）邮件。成功返回 True；未配置或失败返回 False（不抛错）。"""
    if not settings.smtp_enabled:
        log.debug("SMTP 未配置，跳过发信：%s", subject)
        return False
    if not to:
        return False

    msg = EmailMessage()
    msg["From"] = formataddr((settings.smtp_from_name, settings.smtp_sender))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            use_tls=settings.smtp_ssl,            # 465 隐式 SSL
            start_tls=not settings.smtp_ssl,      # 587 STARTTLS
            timeout=timeout,
        )
        log.info("已发邮件 → %s：%s", to, subject)
        return True
    except Exception as exc:  # noqa: BLE001 —— 邮件失败不阻断业务
        log.warning("发邮件失败 → %s：%s（%s）", to, subject, exc)
        return False
