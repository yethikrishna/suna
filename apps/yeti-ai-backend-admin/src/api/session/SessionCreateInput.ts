import { MemoryLogCreateNestedManyWithoutSessionsInput } from "./MemoryLogCreateNestedManyWithoutSessionsInput";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type SessionCreateInput = {
  endTime?: Date | null;
  memoryLogs?: MemoryLogCreateNestedManyWithoutSessionsInput;
  startTime?: Date | null;
  user?: UserWhereUniqueInput | null;
};
