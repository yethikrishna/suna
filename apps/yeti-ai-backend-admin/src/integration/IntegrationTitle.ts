import { Integration as TIntegration } from "../api/integration/Integration";

export const INTEGRATION_TITLE_FIELD = "id";

export const IntegrationTitle = (record: TIntegration): string => {
  return record.id?.toString() || String(record.id);
};
