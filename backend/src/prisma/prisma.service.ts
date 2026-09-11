import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// This backend only ever reads from the shared production-style database —
// it must never create/update/delete rows in it. This extension enforces
// that at runtime (not just by convention): any mutating Prisma call throws
// immediately, regardless of which model it targets.
const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

function createReadOnlyClient() {
  const client = new PrismaClient();
  return client.$extends({
    name: 'read-only-guard',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (WRITE_OPERATIONS.has(operation)) {
            throw new Error(
              `[read-only] Blocked "${operation}" on "${model}" — this backend is read-only by design (see PrismaService).`,
            );
          }
          return query(args);
        },
      },
    },
  });
}

export type ReadOnlyPrismaClient = ReturnType<typeof createReadOnlyClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: ReadOnlyPrismaClient = createReadOnlyClient();

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
