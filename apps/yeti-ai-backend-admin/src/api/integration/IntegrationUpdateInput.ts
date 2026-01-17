import { InputJsonValue } from "../../types";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type IntegrationUpdateInput = {
  configField?: InputJsonValue;
  lastSync?: Date | null;
  status?: "Option1" | null;
  typeField?: "Option1" | null;
  user?: UserWhereUniqueInput | null;
};
