import { Agent } from "../agent/Agent";
import { Integration } from "../integration/Integration";
import { JsonValue } from "type-fest";
import { Session } from "../session/Session";

export type User = {
  agents?: Array<Agent>;
  createdAt: Date;
  email: string | null;
  firstName: string | null;
  id: string;
  integrations?: Array<Integration>;
  lastName: string | null;
  preferences: JsonValue;
  roles: JsonValue;
  sessions?: Array<Session>;
  updatedAt: Date;
  username: string;
};
