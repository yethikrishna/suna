import { JsonFilter } from "../../util/JsonFilter";
import { StringFilter } from "../../util/StringFilter";
import { DateTimeNullableFilter } from "../../util/DateTimeNullableFilter";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type IntegrationWhereInput = {
  configField?: JsonFilter;
  id?: StringFilter;
  lastSync?: DateTimeNullableFilter;
  status?: "Option1";
  typeField?: "Option1";
  user?: UserWhereUniqueInput;
};
