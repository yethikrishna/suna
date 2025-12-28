import { ToolWhereInput } from "./ToolWhereInput";
import { ToolOrderByInput } from "./ToolOrderByInput";

export type ToolFindManyArgs = {
  where?: ToolWhereInput;
  orderBy?: Array<ToolOrderByInput>;
  skip?: number;
  take?: number;
};
