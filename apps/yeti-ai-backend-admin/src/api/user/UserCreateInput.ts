import { AgentCreateNestedManyWithoutUsersInput } from "./AgentCreateNestedManyWithoutUsersInput";
import { IntegrationCreateNestedManyWithoutUsersInput } from "./IntegrationCreateNestedManyWithoutUsersInput";
import { InputJsonValue } from "../../types";
import { SessionCreateNestedManyWithoutUsersInput } from "./SessionCreateNestedManyWithoutUsersInput";

export type UserCreateInput = {
  agents?: AgentCreateNestedManyWithoutUsersInput;
  email?: string | null;
  firstName?: string | null;
  integrations?: IntegrationCreateNestedManyWithoutUsersInput;
  lastName?: string | null;
  password: string;
  preferences?: InputJsonValue;
  roles: InputJsonValue;
  sessions?: SessionCreateNestedManyWithoutUsersInput;
  username: string;
};
