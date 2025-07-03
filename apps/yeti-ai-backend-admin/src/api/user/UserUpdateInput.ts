import { AgentUpdateManyWithoutUsersInput } from "./AgentUpdateManyWithoutUsersInput";
import { IntegrationUpdateManyWithoutUsersInput } from "./IntegrationUpdateManyWithoutUsersInput";
import { InputJsonValue } from "../../types";
import { SessionUpdateManyWithoutUsersInput } from "./SessionUpdateManyWithoutUsersInput";

export type UserUpdateInput = {
  agents?: AgentUpdateManyWithoutUsersInput;
  email?: string | null;
  firstName?: string | null;
  integrations?: IntegrationUpdateManyWithoutUsersInput;
  lastName?: string | null;
  password?: string;
  preferences?: InputJsonValue;
  roles?: InputJsonValue;
  sessions?: SessionUpdateManyWithoutUsersInput;
  username?: string;
};
