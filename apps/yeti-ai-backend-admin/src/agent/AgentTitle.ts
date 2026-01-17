import { Agent as TAgent } from "../api/agent/Agent";

export const AGENT_TITLE_FIELD = "name";

export const AgentTitle = (record: TAgent): string => {
  return record.name?.toString() || String(record.id);
};
