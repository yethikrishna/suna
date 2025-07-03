import { MemoryLog } from "../memoryLog/MemoryLog";
import { Task } from "../task/Task";
import { User } from "../user/User";

export type Agent = {
  activeSession: string | null;
  createdAt: Date;
  description: string | null;
  id: string;
  memoryLogs?: Array<MemoryLog>;
  name: string | null;
  status?: "Option1" | null;
  tasks?: Array<Task>;
  typeField?: "Option1" | null;
  updatedAt: Date;
  user?: User | null;
};
