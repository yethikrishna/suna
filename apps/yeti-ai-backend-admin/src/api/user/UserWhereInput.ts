import { AgentListRelationFilter } from "../agent/AgentListRelationFilter";
import { StringNullableFilter } from "../../util/StringNullableFilter";
import { StringFilter } from "../../util/StringFilter";
import { IntegrationListRelationFilter } from "../integration/IntegrationListRelationFilter";
import { JsonFilter } from "../../util/JsonFilter";
import { SessionListRelationFilter } from "../session/SessionListRelationFilter";

export type UserWhereInput = {
  agents?: AgentListRelationFilter;
  email?: StringNullableFilter;
  firstName?: StringNullableFilter;
  id?: StringFilter;
  integrations?: IntegrationListRelationFilter;
  lastName?: StringNullableFilter;
  preferences?: JsonFilter;
  sessions?: SessionListRelationFilter;
  username?: StringFilter;
};
