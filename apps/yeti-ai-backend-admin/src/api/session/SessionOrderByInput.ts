import { SortOrder } from "../../util/SortOrder";

export type SessionOrderByInput = {
  createdAt?: SortOrder;
  endTime?: SortOrder;
  id?: SortOrder;
  startTime?: SortOrder;
  updatedAt?: SortOrder;
  userId?: SortOrder;
};
