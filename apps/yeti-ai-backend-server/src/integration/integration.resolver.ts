import * as graphql from "@nestjs/graphql";
import { IntegrationResolverBase } from "./base/integration.resolver.base";
import { Integration } from "./base/Integration";
import { IntegrationService } from "./integration.service";

@graphql.Resolver(() => Integration)
export class IntegrationResolver extends IntegrationResolverBase {
  constructor(protected readonly service: IntegrationService) {
    super(service);
  }
}
