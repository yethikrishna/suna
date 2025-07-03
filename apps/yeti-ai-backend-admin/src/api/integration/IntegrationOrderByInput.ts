import { SortOrder } from "../../util/SortOrder";

export type IntegrationOrderByInput = {
  configField?: SortOrder;
  createdAt?: SortOrder;
  id?: SortOrder;
  lastSync?: SortOrder;
  status?: SortOrder;
  typeField?: SortOrder;
  updatedAt?: SortOrder;
  userId?: SortOrder;
};
