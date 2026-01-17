import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import { MemoryLogService } from "./memoryLog.service";
import { MemoryLogControllerBase } from "./base/memoryLog.controller.base";

@swagger.ApiTags("memoryLogs")
@common.Controller("memoryLogs")
export class MemoryLogController extends MemoryLogControllerBase {
  constructor(protected readonly service: MemoryLogService) {
    super(service);
  }
}
