import * as graphql from "@nestjs/graphql";
import { ToolResolverBase } from "./base/tool.resolver.base";
import { Tool } from "./base/Tool";
import { ToolService } from "./tool.service";

@graphql.Resolver(() => Tool)
export class ToolResolver extends ToolResolverBase {
  constructor(protected readonly service: ToolService) {
    super(service);
  }
}
