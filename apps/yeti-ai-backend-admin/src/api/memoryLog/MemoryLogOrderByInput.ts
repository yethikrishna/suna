import { SortOrder } from "../../util/SortOrder";

export type MemoryLogOrderByInput = {
  agentId?: SortOrder;
  content?: SortOrder;
  createdAt?: SortOrder;
  id?: SortOrder;
  relatedTask?: SortOrder;
  sessionId?: SortOrder;
  timestamp?: SortOrder;
  typeField?: SortOrder;
  updatedAt?: SortOrder;
};
