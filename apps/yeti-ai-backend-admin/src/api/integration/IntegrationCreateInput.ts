import { InputJsonValue } from "../../types";
import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type IntegrationCreateInput = {
  configField?: InputJsonValue;
  lastSync?: Date | null;
  status?: "Option1" | null;
  typeField?: "Option1" | null;
  user?: UserWhereUniqueInput | null;
};
