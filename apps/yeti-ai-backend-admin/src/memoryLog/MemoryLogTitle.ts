import { MemoryLog as TMemoryLog } from "../api/memoryLog/MemoryLog";

export const MEMORYLOG_TITLE_FIELD = "id";

export const MemoryLogTitle = (record: TMemoryLog): string => {
  return record.id?.toString() || String(record.id);
};
