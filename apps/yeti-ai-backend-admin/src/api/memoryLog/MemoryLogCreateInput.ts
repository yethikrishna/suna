import { AgentWhereUniqueInput } from "../agent/AgentWhereUniqueInput";
import { SessionWhereUniqueInput } from "../session/SessionWhereUniqueInput";

export type MemoryLogCreateInput = {
  agent?: AgentWhereUniqueInput | null;
  content?: string | null;
  relatedTask?: string | null;
  session?: SessionWhereUniqueInput | null;
  timestamp?: Date | null;
  typeField?: "Option1" | null;
};
