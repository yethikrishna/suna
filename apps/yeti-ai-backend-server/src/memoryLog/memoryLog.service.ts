import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MemoryLogServiceBase } from "./base/memoryLog.service.base";

@Injectable()
export class MemoryLogService extends MemoryLogServiceBase {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }
}
