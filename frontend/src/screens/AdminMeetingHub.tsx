import React from "react";
import * as NS from "../ds";
import { I, Icon } from "../lib/icons";
import { toast } from "../store";
import { DATA } from "../data";
import { AdminMeetings } from "./AdminMeetings";
import { AdminMeetingStats } from "./AdminMeetingStats";
import { AdminStats } from "./AdminStats";
import { AdminRecords } from "./AdminRecords";
import { useIsMobile } from "../lib/useIsMobile";

const SCREENS: Record<string, React.ComponentType<any>> = { AdminMeetings, AdminMeetingStats, AdminStats, AdminRecords };

// AdminMeetingHub — 组会中心: 把「排期 → 数据录入 → 表现评选」这条同源流水线
// 合并到一个带 Tab 的工作台，替代原先三个独立的管理入口。
// 本文件只做 Tab 切换，不重复子页面的标题/逻辑；各子页面保持原样独立渲染。
  const { Tabs } = NS;

  const TABS = [
    { id: "schedule", label: "排期", key: "AdminMeetings" },
    { id: "record", label: "数据录入", key: "AdminMeetingStats" },
    { id: "rank", label: "表现评选", key: "AdminStats" },
    { id: "records", label: "表现记录", key: "AdminRecords" },
  ];

  function AdminMeetingHub() {
    const isMobile = useIsMobile();
    const [tab, setTab] = React.useState("schedule");
    const Active = SCREENS[(TABS.find((t) => t.id === tab) || TABS[0]).key];

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* 顶部分段：组会中心的三个工作流。粘性，子页面在下方滚动区呈现。 */}
        <div style={{ flexShrink: 0, padding: isMobile ? "10px 14px 0" : "10px 32px 0", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
          <Tabs active={tab} onChange={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {Active ? <Active /> : null}
        </div>
      </div>
    );
  }

  export { AdminMeetingHub };
