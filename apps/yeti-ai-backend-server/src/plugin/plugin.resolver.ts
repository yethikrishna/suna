import * as graphql from "@nestjs/graphql";
import { PluginResolverBase } from "./base/plugin.resolver.base";
import { Plugin } from "./base/Plugin";
import { PluginService } from "./plugin.service";

@graphql.Resolver(() => Plugin)
export class PluginResolver extends PluginResolverBase {
  constructor(protected readonly service: PluginService) {
    super(service);
  }
}
