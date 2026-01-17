import { AgentWhereUniqueInput } from "../agent/AgentWhereUniqueInput";
import { StringNullableFilter } from "../../util/StringNullableFilter";
import { StringFilter } from "../../util/StringFilter";
import { DateTimeNullableFilter } from "../../util/DateTimeNullableFilter";

export type TaskWhereInput = {
  agent?: AgentWhereUniqueInput;
  description?: StringNullableFilter;
  id?: StringFilter;
  output?: StringNullableFilter;
  parentTask?: StringNullableFilter;
  relatedSession?: StringNullableFilter;
  scheduledTime?: DateTimeNullableFilter;
  status?: "Option1";
  title?: StringNullableFilter;
};
