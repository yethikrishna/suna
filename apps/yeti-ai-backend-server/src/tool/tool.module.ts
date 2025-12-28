import { Module } from "@nestjs/common";
import { ToolModuleBase } from "./base/tool.module.base";
import { ToolService } from "./tool.service";
import { ToolController } from "./tool.controller";
import { ToolResolver } from "./tool.resolver";

@Module({
  imports: [ToolModuleBase],
  controllers: [ToolController],
  providers: [ToolService, ToolResolver],
  exports: [ToolService],
})
export class ToolModule {}
