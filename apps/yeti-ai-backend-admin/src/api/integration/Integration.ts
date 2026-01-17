import { JsonValue } from "type-fest";
import { User } from "../user/User";

export type Integration = {
  configField: JsonValue;
  createdAt: Date;
  id: string;
  lastSync: Date | null;
  status?: "Option1" | null;
  typeField?: "Option1" | null;
  updatedAt: Date;
  user?: User | null;
};
