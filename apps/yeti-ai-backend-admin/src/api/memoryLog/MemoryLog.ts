import { Agent } from "../agent/Agent";
import { Session } from "../session/Session";

export type MemoryLog = {
  agent?: Agent | null;
  content: string | null;
  createdAt: Date;
  id: string;
  relatedTask: string | null;
  session?: Session | null;
  timestamp: Date | null;
  typeField?: "Option1" | null;
  updatedAt: Date;
};
