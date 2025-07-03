import { AgentWhereUniqueInput } from "../agent/AgentWhereUniqueInput";

export type TaskUpdateInput = {
  agent?: AgentWhereUniqueInput | null;
  description?: string | null;
  output?: string | null;
  parentTask?: string | null;
  relatedSession?: string | null;
  scheduledTime?: Date | null;
  status?: "Option1" | null;
  title?: string | null;
};
