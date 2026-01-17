import { AgentWhereUniqueInput } from "../agent/AgentWhereUniqueInput";
import { StringNullableFilter } from "../../util/StringNullableFilter";
import { StringFilter } from "../../util/StringFilter";
import { SessionWhereUniqueInput } from "../session/SessionWhereUniqueInput";
import { DateTimeNullableFilter } from "../../util/DateTimeNullableFilter";

export type MemoryLogWhereInput = {
  agent?: AgentWhereUniqueInput;
  content?: StringNullableFilter;
  id?: StringFilter;
  relatedTask?: StringNullableFilter;
  session?: SessionWhereUniqueInput;
  timestamp?: DateTimeNullableFilter;
  typeField?: "Option1";
};
