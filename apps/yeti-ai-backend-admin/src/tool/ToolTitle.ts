import { Tool as TTool } from "../api/tool/Tool";

export const TOOL_TITLE_FIELD = "id";

export const ToolTitle = (record: TTool): string => {
  return record.id?.toString() || String(record.id);
};
