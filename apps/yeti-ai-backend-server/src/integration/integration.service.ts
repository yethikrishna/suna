import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationServiceBase } from "./base/integration.service.base";

@Injectable()
export class IntegrationService extends IntegrationServiceBase {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }
}
