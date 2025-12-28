import { Module } from "@nestjs/common";
import { MemoryLogModuleBase } from "./base/memoryLog.module.base";
import { MemoryLogService } from "./memoryLog.service";
import { MemoryLogController } from "./memoryLog.controller";
import { MemoryLogResolver } from "./memoryLog.resolver";

@Module({
  imports: [MemoryLogModuleBase],
  controllers: [MemoryLogController],
  providers: [MemoryLogService, MemoryLogResolver],
  exports: [MemoryLogService],
})
export class MemoryLogModule {}
