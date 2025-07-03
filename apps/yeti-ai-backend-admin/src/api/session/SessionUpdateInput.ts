import { MemoryLogUpdateManyWithoutSessionsInput } from "./MemoryLogUpdateManyWithoutSessionsInput";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type SessionUpdateInput = {
  endTime?: Date | null;
  memoryLogs?: MemoryLogUpdateManyWithoutSessionsInput;
  startTime?: Date | null;
  user?: UserWhereUniqueInput | null;
};
