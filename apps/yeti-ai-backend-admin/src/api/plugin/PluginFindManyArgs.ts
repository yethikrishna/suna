import { PluginWhereInput } from "./PluginWhereInput";
import { PluginOrderByInput } from "./PluginOrderByInput";

export type PluginFindManyArgs = {
  where?: PluginWhereInput;
  orderBy?: Array<PluginOrderByInput>;
  skip?: number;
  take?: number;
};
