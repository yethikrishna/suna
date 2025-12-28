import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { ToolService } from "./tool.service";
import { ToolControllerBase } from "./base/tool.controller.base";

@swagger.ApiTags("tools")
@common.Controller("tools")
export class ToolController extends ToolControllerBase {
  constructor(protected readonly service: ToolService) {
    super(service);
  }
}
