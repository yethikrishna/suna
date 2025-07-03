import { JsonValue } from "type-fest";

export type Plugin = {
  configField: JsonValue;
  createdAt: Date;
  description: string | null;
  id: string;
  name: string | null;
  permissionRequired: boolean | null;
  status?: "Option1" | null;
  updatedAt: Date;
  version: string | null;
};
