import { SortOrder } from "../../util/SortOrder";

export type PluginOrderByInput = {
  configField?: SortOrder;
  createdAt?: SortOrder;
  description?: SortOrder;
  id?: SortOrder;
  name?: SortOrder;
  permissionRequired?: SortOrder;
  status?: SortOrder;
  updatedAt?: SortOrder;
  version?: SortOrder;
};
