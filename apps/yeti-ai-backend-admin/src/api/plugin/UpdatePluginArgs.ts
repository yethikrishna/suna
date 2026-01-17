import { PluginWhereUniqueInput } from "./PluginWhereUniqueInput";
import { PluginUpdateInput } from "./PluginUpdateInput";

export type UpdatePluginArgs = {
  where: PluginWhereUniqueInput;
  data: PluginUpdateInput;
};
