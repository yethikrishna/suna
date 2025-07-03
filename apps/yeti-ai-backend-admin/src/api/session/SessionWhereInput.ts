import { DateTimeNullableFilter } from "../../util/DateTimeNullableFilter";
import { StringFilter } from "../../util/StringFilter";
import { MemoryLogListRelationFilter } from "../memoryLog/MemoryLogListRelationFilter";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type SessionWhereInput = {
  endTime?: DateTimeNullableFilter;
  id?: StringFilter;
  memoryLogs?: MemoryLogListRelationFilter;
  startTime?: DateTimeNullableFilter;
  user?: UserWhereUniqueInput;
};
