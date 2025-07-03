import { MemoryLogCreateNestedManyWithoutAgentsInput } from "./MemoryLogCreateNestedManyWithoutAgentsInput";
import { TaskCreateNestedManyWithoutAgentsInput } from "./TaskCreateNestedManyWithoutAgentsInput";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type AgentCreateInput = {
  activeSession?: string | null;
  description?: string | null;
  memoryLogs?: MemoryLogCreateNestedManyWithoutAgentsInput;
  name?: string | null;
  status?: "Option1" | null;
  tasks?: TaskCreateNestedManyWithoutAgentsInput;
  typeField?: "Option1" | null;
  user?: UserWhereUniqueInput | null;
};
