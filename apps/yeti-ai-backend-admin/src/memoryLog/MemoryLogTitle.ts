import { MemoryLog as TMemoryLog } from "../api/memoryLog/MemoryLog";

export const MEMORYLOG_TITLE_FIELD = "relatedTask";

export const MemoryLogTitle = (record: TMemoryLog): string => {
  return record.relatedTask?.toString() || String(record.id);
};
