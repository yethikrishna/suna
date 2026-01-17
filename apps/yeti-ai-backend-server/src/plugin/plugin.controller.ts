import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { PluginService } from "./plugin.service";
import { PluginControllerBase } from "./base/plugin.controller.base";

@swagger.ApiTags("plugins")
@common.Controller("plugins")
export class PluginController extends PluginControllerBase {
  constructor(protected readonly service: PluginService) {
    super(service);
  }
}
