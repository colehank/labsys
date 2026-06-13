"""北师大 vc.bnu.edu.cn 门户腾讯会议预约（Playwright 异步自动化）。

本模块通过 Playwright 驱动 Chromium 模拟人工操作：登录北师大统一身份认证、
在视频会议门户里新建一场会议、把「会议室组」选为「腾讯会议」并提交，最后从
会议列表里读回会议号 / 密码 / 链接。

重要说明：
- 这是对北师大门户网页的 **浏览器自动化**，并非腾讯会议官方 API，门户改版可能导致失效。
- 运行前需安装浏览器内核：``playwright install chromium``。
- 凭据（account / account_password / booking_url）全部由调用方以参数注入，
  本模块 **不读取** 任何环境变量或 settings，保持纯函数、可测试。

对外只暴露一个入口：``book_tencent_meeting``。
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from playwright.async_api import (
    Page,
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
    expect,
)

# ============================================================================
# 内联常量（原仓库 app/utils/constants.py + config_manager 的默认值）
# ============================================================================
# Playwright 超时配置（毫秒）
PLAYWRIGHT_TIMEOUT_SHORT = 1500
PLAYWRIGHT_TIMEOUT_MEDIUM = 2000
PLAYWRIGHT_TIMEOUT_LONG = 3000
PLAYWRIGHT_VISIBILITY_TIMEOUT = 5000

# 会议默认密码（原 DEFAULT_MEETING_PASSWORD）
DEFAULT_MEETING_PASSWORD = "123456"

# 「会议室组」目标选项 —— 选腾讯会议的关键文本
TENCENT_ROOM_GROUP = "腾讯会议"


# ============================================================================
# 辅助函数（均为 async，逐一对应原同步脚本）
# ============================================================================
async def _check_dialog(page: Page) -> bool:
    """是否存在可见的 Element UI 弹窗。"""
    wrappers = page.locator("div.el-dialog__wrapper:visible")
    return await wrappers.count() > 0


async def _handle_dialog(page: Page) -> None:
    """关闭登录后出现的「须知 / 提示 / 公告」弹窗。

    容忍多种形态：可能有「我已阅读」复选框，确认按钮文案不一（确定 / 知道了 /
    同意 …），都没有时退回右上角关闭按钮或 Escape。任何一步失败都不抛错。
    """
    wrappers = page.locator("div.el-dialog__wrapper:visible")
    if await wrappers.count() == 0:
        return
    wrapper = wrappers.last
    # 1) 勾选「我已阅读」类复选框（若存在）
    try:
        checkbox = wrapper.locator("input.el-checkbox__original").first
        if await checkbox.count() > 0:
            await checkbox.dispatch_event("click")
    except Exception:
        pass
    # 2) 依次尝试常见确认按钮文案
    for name in ("确定", "我知道了", "知道了", "我已阅读", "同意", "确认"):
        try:
            btn = wrapper.locator(
                f"button:has-text('{name}'):not(.is-disabled)"
            ).first
            if await btn.count() > 0 and await btn.is_visible():
                await btn.click()
                return
        except Exception:
            pass
    # 3) 兜底：任意可用的 primary 按钮
    try:
        btn = wrapper.locator("button.el-button--primary:not(.is-disabled)").first
        if await btn.count() > 0 and await btn.is_visible():
            await btn.click()
            return
    except Exception:
        pass
    # 4) 再兜底：右上角关闭按钮 / Escape
    try:
        close = wrapper.locator(".el-dialog__headerbtn").first
        if await close.count() > 0:
            await close.click()
            return
    except Exception:
        pass
    try:
        await page.keyboard.press("Escape")
    except Exception:
        pass


async def _dismiss_dialogs(page: Page, rounds: int = 5) -> None:
    """反复关闭可见弹窗，直到清空为止；含对「迟出现」弹窗的短暂等待。

    门户的公告/须知弹窗有时在 networkidle 之后才异步弹出，会拦截后续点击，
    故在关键操作前调用本函数把遮罩清干净。
    """
    for _ in range(rounds):
        # 给迟出现的弹窗一点时间冒出来
        try:
            await page.locator("div.el-dialog__wrapper:visible").last.wait_for(
                state="visible", timeout=PLAYWRIGHT_TIMEOUT_SHORT
            )
        except Exception:
            pass
        if not await _check_dialog(page):
            return
        await _handle_dialog(page)
        await page.wait_for_timeout(800)


async def _select_room_group(page: Page, target_text: str = TENCENT_ROOM_GROUP) -> None:
    """把「会议室组:」下拉选为目标文本（默认腾讯会议）。"""
    # 1) 精确定位「会议室组:」这一项，避免页面上其他 el-select 干扰
    form_item = page.locator(".el-form-item").filter(has_text="会议室组:")

    # 2) 点开下拉
    input_box = form_item.locator(".el-input__inner")
    await input_box.click()

    # 3) 等待下拉浮层出现（Element UI 渲染 .el-select-dropdown）
    dropdown = page.locator(".el-select-dropdown:visible")
    await expect(dropdown).to_be_visible()

    # 4) 在可见下拉里选择包含目标文本的选项
    option = dropdown.locator(".el-select-dropdown__item", has_text=target_text).first
    await option.click()


async def _fill_item(page: Page, label: str, content: str) -> None:
    """按表单项标签填写文本输入框（如「主题」「密码」）。"""
    form_item = page.locator(".el-form-item", has_text=label)
    input_box = form_item.locator("input.el-input__inner")
    await input_box.fill(content)


async def _clear_and_type(input_locator: Any, text: str) -> None:
    """清空输入框并逐字输入后回车失焦（兼容 Vue v-model 绑定）。"""
    await input_locator.click()
    try:
        await input_locator.press("Meta+A")
    except Exception:
        pass  # Meta+A 不可用时退回 Control+A
    await input_locator.press("Control+A")
    await input_locator.press("Delete")
    await input_locator.type(text)
    await input_locator.press("Enter")
    await input_locator.blur()


async def _set_meeting_date(page: Page, date_str: str) -> None:
    """设置「日期」，例如 '2026-06-20'。"""
    form_item = page.locator(".el-form-item", has_text="日期:")
    input_box = form_item.locator(".el-date-editor--date input.el-input__inner")
    await expect(input_box).to_be_visible()
    await _clear_and_type(input_box, date_str)


async def _set_meeting_time(page: Page, time_str: str) -> None:
    """可靠设置「时间」：尝试面板点选，否则直接输入并派发 input/change 事件。"""
    form_item = page.locator(".el-form-item", has_text="时间:")
    input_box = form_item.locator(".el-date-editor--time-select input.el-input__inner")
    await expect(input_box).to_be_visible(timeout=PLAYWRIGHT_VISIBILITY_TIMEOUT)

    # 1) 聚焦 + 点击后缀图标，尽力打开面板
    await input_box.click()
    try:
        await form_item.locator(
            ".el-date-editor--time-select .el-input__suffix"
        ).click()
    except Exception:
        pass  # 后缀图标可能不可点

    # 2) 等候任何可能的时间面板（ElementUI/Plus 常见三类）
    panel = page.locator(
        ".el-picker-panel:visible, .el-time-panel:visible, .el-select-dropdown:visible"
    )
    if await panel.count() > 0:
        try:
            await expect(panel).to_be_visible(timeout=PLAYWRIGHT_TIMEOUT_SHORT)
        except Exception:
            pass  # 面板可能不出现

    # 3) 如果真有面板，优先在面板里点选
    if await panel.count() > 0 and await panel.is_visible():
        option = (
            panel.locator(".el-time-panel__item", has_text=time_str)
            .or_(panel.locator("li", has_text=time_str))
            .or_(panel.locator("span", has_text=time_str))
            .first
        )
        if await option.count() > 0:
            await option.scroll_into_view_if_needed()
            await option.click()
            # 某些实现需要点「确定」
            try:
                ok_btn = panel.locator("button:has-text('确定')")
                if await ok_btn.is_visible():
                    await ok_btn.click()
            except Exception:
                pass  # 「确定」按钮可能不存在或不可点
        else:
            # 面板存在但找不到精确项：直接输入
            await _clear_and_type(input_box, time_str)
    else:
        # 4) 面板没出现：直接输入 + 派发事件（Vue v-model 需要 input/change）
        await _clear_and_type(input_box, time_str)
        handle = await input_box.element_handle()
        await page.evaluate(
            """({el, val}) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.blur();
            }""",
            {"el": handle, "val": time_str},
        )

    # 5) 最终校验（兼容 '18:00' 与 '18:00:00'，只比对到分钟）
    def _norm(v: str) -> str:
        v = v.strip()
        return v if len(v) == 5 else v[:5]

    actual = await input_box.input_value()
    if _norm(actual) != _norm(time_str):
        raise RuntimeError(f"时间未设置成功：期望 {time_str}，实际 {actual}")


async def _set_meeting_duration(page: Page, hours: float) -> None:
    """选择「时长」。hours 支持 0.5 步长，如 0.5, 1, 1.5, ... 48。"""
    hours = float(hours)
    label = f"{hours:g}小时" if hours.is_integer() else f"{hours}小时"
    form_item = page.locator(".el-form-item", has_text="时长:")
    trigger = form_item.locator(".el-select .el-input__inner")
    await trigger.click()

    dropdown = page.locator(".el-select-dropdown:visible")
    await expect(dropdown).to_be_visible()

    option = dropdown.locator("li.el-select-dropdown__item", has_text=label)
    await option.first.click()
    await expect(trigger).to_have_value(label)


async def _set_schedule(
    page: Page, date_str: str, time_str: str, duration_hours: float
) -> None:
    """一次性设置 日期 / 时间 / 时长。"""
    await _set_meeting_date(page, date_str)
    await _set_meeting_time(page, time_str)
    await _set_meeting_duration(page, duration_hours)
    # 某些页面会根据时间触发「空闲时间」加载，可选地等 loading 遮罩消失（不抛错）
    loading_mask = page.locator(".freebusy .el-loading-mask")
    try:
        await loading_mask.wait_for(state="hidden", timeout=PLAYWRIGHT_TIMEOUT_LONG)
    except Exception:
        pass  # 遮罩可能不存在或超时


async def _wait_freebusy_ready(page: Page) -> None:
    """等「空闲时间」网格真正加载完成 —— 否则「提交申请」按钮点击无效。

    门户在选定日期/时间后异步拉取 freebusy 网格；先等 loading 遮罩出现再消失，
    并等到至少出现一个时段单元（「可用」），确保提交时网格已就绪。
    """
    mask = page.locator(".freebusy .el-loading-mask")
    try:
        # 给遮罩一点时间出现（若加载很快没出现也无妨）
        await mask.wait_for(state="visible", timeout=PLAYWRIGHT_TIMEOUT_SHORT)
    except Exception:
        pass
    try:
        await mask.wait_for(state="hidden", timeout=PLAYWRIGHT_VISIBILITY_TIMEOUT * 3)
    except Exception:
        pass
    # 等到网格出现可用时段单元，最长再等若干秒
    try:
        await page.locator(".freebusy").get_by_text("可用").first.wait_for(
            state="visible", timeout=PLAYWRIGHT_VISIBILITY_TIMEOUT * 2
        )
    except Exception:
        pass


async def _submit_and_confirm(page: Page) -> None:
    """点击真实的「提交申请」按钮，并尽力确认「成功」弹窗。

    「成功」弹窗只是确认提示，真正的真相源是后续「会议列表」——故确认弹窗
    采用容错策略：出现就点「确定」关闭，超时不出现也不抛错，交由会议列表读回判定。
    """
    await _wait_freebusy_ready(page)
    # 真实按钮文案是「提交申请」（含「提交」），滚动到可见再点
    btn = page.get_by_role("button", name="提交申请")
    if await btn.count() == 0:
        btn = page.locator("button:has-text('提交')").last
    await btn.scroll_into_view_if_needed()
    await btn.click()
    # 成功弹窗：出现则关闭，不出现则跳过（不阻断后续读回）
    try:
        ok = page.get_by_role("dialog", name="成功").get_by_role("button", name="确定")
        await ok.click(timeout=PLAYWRIGHT_VISIBILITY_TIMEOUT * 2)
    except Exception:
        # 弹窗未在预期时间出现：可能已提交成功只是确认框未捕获，继续走会议列表读回
        await page.wait_for_timeout(PLAYWRIGHT_TIMEOUT_MEDIUM)


async def _filter_list_by(page: Page, query: str) -> None:
    """在会议列表用搜索框按关键词过滤，避免会议多于一页时目标行落到后续页。

    也起到「刷新」作用：重新查询能拿到刚由门户批准、会议号已发放的最新状态。
    搜索框/按钮缺失或交互失败都不抛错（退回不过滤的整页扫描）。
    """
    try:
        box = page.locator("input[placeholder*='搜索']").first
        if await box.count() == 0:
            return
        await box.fill(query)
        btn = page.get_by_role("button", name="搜索")
        if await btn.count() > 0:
            await btn.first.click()
        else:
            await box.press("Enter")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(800)
    except Exception:
        pass


async def _get_meeting_info(
    page: Page,
    topic: str,
    start_time: str,
    *,
    retries: int = 14,
    interval_ms: int = 13000,
) -> dict[str, str]:
    """在会议列表页按 start_time(YYYY-MM-DD HH:mm) 和 topic 匹配行，取会议号 / 密码。

    门户新预约先进「提交(待批准)」态，**会议号要等门户自动批准后才发放**
    （实测约 1~3 分钟）。故此处轮询：每轮用搜索框按日期过滤（绕开分页 + 刷新状态）
    后重读，匹配行且已发会议号才返回；只匹配到行但号未发则等待重试。
    """
    date_part = start_time.split(" ")[0]  # 'YYYY-MM-DD'，按日期过滤最稳
    last_err = "未在会议列表中找到匹配的会议行"
    for attempt in range(retries):
        await _filter_list_by(page, date_part)
        try:
            await page.wait_for_selector(
                ".el-table__body tr.el-table__row",
                timeout=PLAYWRIGHT_VISIBILITY_TIMEOUT,
            )
        except Exception:
            pass

        rows = page.locator(".el-table__body tr.el-table__row")
        n = await rows.count()
        # 时间为主、主题为辅匹配：列表里长主题可能被截断/换行，故只要时间命中即视为候选，
        # 主题命中（双向子串，容忍截断）优先；都无主题命中时取第一条时间命中行。
        time_only: int | None = None
        target_row = None
        for i in range(n):
            row = rows.nth(i)
            # 各列：时间、主题、会议信息 分别是第 3、5、10 列（从 1 开始）
            time_text = (await row.locator("td").nth(2).inner_text()).strip()
            topic_text = (await row.locator("td").nth(4).inner_text()).strip()
            if start_time not in time_text:
                continue
            if time_only is None:
                time_only = i
            if topic and (topic in topic_text or topic_text in topic):
                target_row = row
                break
        if target_row is None and time_only is not None:
            target_row = rows.nth(time_only)

        if target_row is not None:
            info_text = (await target_row.locator("td").nth(9).inner_text()).strip()
            # 例：'会议号:788378215\n密码:123456'；待批准时 '会议号:\n密码:123456'
            m_id = re.search(r"会议号[:：]\s*(\d+)", info_text)
            m_pw = re.search(r"密码[:：]\s*([0-9A-Za-z]+)", info_text)
            if m_id and m_pw:
                return {"meeting_id": m_id.group(1), "password": m_pw.group(1)}
            last_err = "会议已提交但门户尚未发放会议号（待自动批准，请稍后重试）"

        # 未就绪：等待后下一轮重新搜索（即刷新）重试
        if attempt < retries - 1:
            await page.wait_for_timeout(interval_ms)

    raise RuntimeError(last_err)


def _parse_meeting_info(text: str) -> dict[str, str]:
    """解析「复制信息」的剪贴板文本，抽取主题 / 时间 / 链接 / 会议号 / 密码。"""
    info: dict[str, str] = {}
    text = text.strip()

    match = re.search(r"会议主题[:：]\s*(.+)", text)
    if match:
        info["会议主题"] = match.group(1).strip()

    match = re.search(r"会议时间[:：]\s*(.+)", text)
    if match:
        info["会议时间"] = match.group(1).strip()

    match = re.search(r"(https?://[^\s]+)", text)
    if match:
        info["会议链接"] = match.group(1).strip()

    # 会议号（兼容「腾讯会议」「会议ID」等写法）
    match = re.search(r"[#＃]?[腾讯]*会议[:：]?\s*(\d+)", text)
    if match:
        info["会议号"] = match.group(1).strip()

    match = re.search(r"会议密码[:：]\s*(\d+)", text)
    if match:
        info["会议密码"] = match.group(1).strip()

    return info


async def _get_meeting_info_url(page: Page, meeting_num: str) -> dict[str, str]:
    """点开指定会议号那行的「查看」→「复制信息」，读剪贴板并解析详情。"""
    row = page.locator("tr", has_text=meeting_num)
    await row.locator("button[title='查看']").click()
    await page.wait_for_selector("a", state="visible")
    await page.locator("a").filter(has_text="复制信息").click()
    # async 里读剪贴板：navigator.clipboard.readText() 返回 Promise，page.evaluate 会自动 await
    clipboard_text = await page.evaluate("navigator.clipboard.readText()")
    return _parse_meeting_info(clipboard_text or "")


def _assert_timing(date: str, time_: str) -> None:
    """校验「预约时间须晚于当前」，失败抛 ValueError。"""
    try:
        this_time = datetime.strptime(f"{date} {time_}", "%Y-%m-%d %H:%M")
    except ValueError as exc:
        raise ValueError(
            f"日期或时间格式不正确（应为 '2026-06-20' 与 '14:00'）：{date} {time_}"
        ) from exc
    if this_time <= datetime.now():
        raise ValueError("预约时间必须在当前时间之后")


# ============================================================================
# 唯一对外入口
# ============================================================================
async def book_tencent_meeting(
    *,
    topic: str,
    date: str,
    time: str,
    duration_hours: float,
    password: str,
    account: str,
    account_password: str,
    booking_url: str,
    headless: bool = True,
) -> dict:
    """在 vc.bnu.edu.cn 预约一场腾讯会议。

    date 形如 '2026-06-20'，time 形如 '14:00'，duration_hours 如 2.0。
    account/account_password = 校园统一身份认证账号密码（调用方从 settings 注入，本函数不读环境变量）。
    返回 {'url': str, 'meeting_id': str, 'password': str, 'topic': str, 'time': str}。
    失败抛异常（带可读中文信息）。
    """
    # 1) 入参校验（纯函数，不触网）
    _assert_timing(date, time)
    meeting_password = password or DEFAULT_MEETING_PASSWORD
    hours = float(duration_hours)
    if not ((hours * 2).is_integer() and 0.5 <= hours <= 48):
        raise ValueError("时长必须是 0.5~48 小时且步长为 0.5")

    start_time = f"{date} {time}"

    try:
        async with async_playwright() as p:
            # 启动 Chromium（需先 playwright install chromium）
            browser = await p.chromium.launch(headless=headless)
            context = await browser.new_context(
                permissions=["clipboard-read", "clipboard-write"]
            )
            page = await context.new_page()
            try:
                # 2) 打开预约页面并登录
                await page.goto(booking_url)
                await page.click("text=统一身份认证登录")

                # 输入账号
                username_area = page.locator("div").filter(
                    has_text=re.compile(r"^用户名$")
                )
                await username_area.locator("input").fill(account)
                # 输入密码
                password_area = page.locator("div").filter(
                    has_text=re.compile(r"^密码$")
                )
                await password_area.locator("input").fill(account_password)
                # 点击登录并等待跳转
                await page.click("a:has-text('登录')")
                await page.wait_for_load_state("networkidle")

                # 3) 处理登录后可能的弹窗（须知 / 公告，可能迟出现）
                await _dismiss_dialogs(page)

                # 4) 新建会议表单 —— 点击前再清一次弹窗，被拦截则清完重试
                await _dismiss_dialogs(page)
                try:
                    await page.click(
                        "text=新建会议",
                        timeout=PLAYWRIGHT_VISIBILITY_TIMEOUT * 2,
                    )
                except PlaywrightTimeoutError:
                    await _dismiss_dialogs(page)
                    await page.click("text=新建会议")
                await page.wait_for_load_state("networkidle")
                # 选腾讯会议（这是选腾讯的关键步骤）
                await _select_room_group(page, TENCENT_ROOM_GROUP)
                await _fill_item(page, "主题", topic)
                await _fill_item(page, "密码", meeting_password)
                await _set_schedule(page, date, time, hours)

                # 5) 提交并确认（等 freebusy 网格就绪 → 点「提交申请」→ 确认成功弹窗）
                await _submit_and_confirm(page)

                # 6) 跳到会议列表读回会议信息
                await page.click("text=会议列表")
                await page.wait_for_load_state("networkidle")
                await page.wait_for_timeout(PLAYWRIGHT_TIMEOUT_MEDIUM)

                basic_info = await _get_meeting_info(page, topic, start_time)
                meeting_id = basic_info["meeting_id"]
                # 兜底逻辑：详情解析失败则降级返回基础会议号 / 密码
                try:
                    whole_info = await _get_meeting_info_url(page, meeting_id)
                    url = whole_info.get("会议链接", "")
                    final_id = whole_info.get("会议号", meeting_id)
                    final_pw = whole_info.get("会议密码", basic_info["password"])
                except Exception:
                    # 详情页 / 剪贴板读取失败：降级为基础信息
                    url = ""
                    final_id = meeting_id
                    final_pw = basic_info["password"]

                return {
                    "url": url,
                    "meeting_id": final_id,
                    "password": final_pw,
                    "topic": topic,
                    "time": start_time,
                }
            finally:
                # 清理浏览器资源
                await context.close()
                await browser.close()
    except (ValueError,):
        # 入参类异常原样抛出
        raise
    except PlaywrightTimeoutError as exc:
        raise RuntimeError(
            f"预约腾讯会议超时（页面元素未在预期时间内出现）：{exc}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"预约腾讯会议失败：{exc}") from exc
