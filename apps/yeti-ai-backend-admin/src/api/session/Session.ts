import { MemoryLog } from "../memoryLog/MemoryLog";
import { User } from "../user/User";

export type Session = {
  createdAt: Date;
  endTime: Date | null;
  id: string;
  memoryLogs?: Array<MemoryLog>;
  startTime: Date | null;
  updatedAt: Date;
  user?: User | null;
};
