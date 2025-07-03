import { Module } from "@nestjs/common";
import { PluginModuleBase } from "./base/plugin.module.base";
import { PluginService } from "./plugin.service";
import { PluginController } from "./plugin.controller";
import { PluginResolver } from "./plugin.resolver";

@Module({
  imports: [PluginModuleBase],
  controllers: [PluginController],
  providers: [PluginService, PluginResolver],
  exports: [PluginService],
})
export class PluginModule {}
