import { IntegrationWhereInput } from "./IntegrationWhereInput";
import { IntegrationOrderByInput } from "./IntegrationOrderByInput";

export type IntegrationFindManyArgs = {
  where?: IntegrationWhereInput;
  orderBy?: Array<IntegrationOrderByInput>;
  skip?: number;
  take?: number;
};
