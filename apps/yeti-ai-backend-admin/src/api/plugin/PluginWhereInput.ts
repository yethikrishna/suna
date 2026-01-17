import { JsonFilter } from "../../util/JsonFilter";
import { StringNullableFilter } from "../../util/StringNullableFilter";
import { StringFilter } from "../../util/StringFilter";
import { BooleanNullableFilter } from "../../util/BooleanNullableFilter";

export type PluginWhereInput = {
  configField?: JsonFilter;
  description?: StringNullableFilter;
  id?: StringFilter;
  name?: StringNullableFilter;
  permissionRequired?: BooleanNullableFilter;
  status?: "Option1";
  version?: StringNullableFilter;
};
