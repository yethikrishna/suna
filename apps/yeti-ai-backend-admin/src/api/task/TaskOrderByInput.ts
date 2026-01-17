import { SortOrder } from "../../util/SortOrder";

export type TaskOrderByInput = {
  agentId?: SortOrder;
  createdAt?: SortOrder;
  description?: SortOrder;
  id?: SortOrder;
  output?: SortOrder;
  parentTask?: SortOrder;
  relatedSession?: SortOrder;
  scheduledTime?: SortOrder;
  status?: SortOrder;
  title?: SortOrder;
  updatedAt?: SortOrder;
};
