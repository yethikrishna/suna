import { Module } from "@nestjs/common";
import { IntegrationModuleBase } from "./base/integration.module.base";
import { IntegrationService } from "./integration.service";
import { IntegrationController } from "./integration.controller";
import { IntegrationResolver } from "./integration.resolver";

@Module({
  imports: [IntegrationModuleBase],
  controllers: [IntegrationController],
  providers: [IntegrationService, IntegrationResolver],
  exports: [IntegrationService],
})
export class IntegrationModule {}
