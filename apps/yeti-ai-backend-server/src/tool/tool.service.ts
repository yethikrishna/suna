import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ToolServiceBase } from "./base/tool.service.base";

@Injectable()
export class ToolService extends ToolServiceBase {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }
}
