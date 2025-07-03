import { MemoryLogWhereInput } from "./MemoryLogWhereInput";
import { MemoryLogOrderByInput } from "./MemoryLogOrderByInput";

export type MemoryLogFindManyArgs = {
  where?: MemoryLogWhereInput;
  orderBy?: Array<MemoryLogOrderByInput>;
  skip?: number;
  take?: number;
};
