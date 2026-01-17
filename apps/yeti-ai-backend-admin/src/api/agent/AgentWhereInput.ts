import { StringNullableFilter } from "../../util/StringNullableFilter";
import { StringFilter } from "../../util/StringFilter";
import { MemoryLogListRelationFilter } from "../memoryLog/MemoryLogListRelationFilter";
import { TaskListRelationFilter } from "../task/TaskListRelationFilter";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type AgentWhereInput = {
  activeSession?: StringNullableFilter;
  description?: StringNullableFilter;
  id?: StringFilter;
  memoryLogs?: MemoryLogListRelationFilter;
  name?: StringNullableFilter;
  status?: "Option1";
  tasks?: TaskListRelationFilter;
  typeField?: "Option1";
  user?: UserWhereUniqueInput;
};
