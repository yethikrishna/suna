import * as graphql from "@nestjs/graphql";
import { MemoryLogResolverBase } from "./base/memoryLog.resolver.base";
import { MemoryLog } from "./base/MemoryLog";
import { MemoryLogService } from "./memoryLog.service";

@graphql.Resolver(() => MemoryLog)
export class MemoryLogResolver extends MemoryLogResolverBase {
  constructor(protected readonly service: MemoryLogService) {
    super(service);
  }
}
