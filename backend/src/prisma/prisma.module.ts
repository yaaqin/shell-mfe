import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Read-only access to the shared database — see PrismaService for the
// runtime guard that blocks any create/update/delete call.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
