import { MemoryLogUpdateManyWithoutAgentsInput } from "./MemoryLogUpdateManyWithoutAgentsInput";
import { TaskUpdateManyWithoutAgentsInput } from "./TaskUpdateManyWithoutAgentsInput";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type AgentUpdateInput = {
  activeSession?: string | null;
  description?: string | null;
  memoryLogs?: MemoryLogUpdateManyWithoutAgentsInput;
  name?: string | null;
  status?: "Option1" | null;
  tasks?: TaskUpdateManyWithoutAgentsInput;
  typeField?: "Option1" | null;
  user?: UserWhereUniqueInput | null;
};
