import { InputJsonValue } from "../../types";

export type PluginUpdateInput = {
  configField?: InputJsonValue;
  description?: string | null;
  name?: string | null;
  permissionRequired?: boolean | null;
  status?: "Option1" | null;
  version?: string | null;
};
