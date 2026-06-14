// 请求状态机：每个 kind 的初始态与合法迁移。
// UI 据此决定显示哪些「下一步」操作按钮；后端 advance_request 另有权威校验。
// 这是一份纯常量（不会漂移），与会变动的业务数据无关，故独立于 STORE 存放。
export const REQ_FLOW: Record<string, { initial: string; transitions: Record<string, string[]> }> = {
  swap: { initial: "pending", transitions: { pending: ["accepted", "declined", "cancelled"], accepted: [], declined: [], cancelled: [] } },
  absence: { initial: "submitted", transitions: { submitted: ["approved", "rejected", "cancelled"], approved: [], rejected: [], cancelled: [] } },
  api: { initial: "submitted", transitions: { submitted: ["approved", "rejected", "cancelled"], approved: [], rejected: [], cancelled: [] } },
  ssh: { initial: "submitted", transitions: { submitted: ["approved", "rejected", "cancelled"], approved: [], rejected: [], cancelled: [] } },
};
