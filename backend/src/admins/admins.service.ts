import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Read-only lookups against the existing `admins` table. No create/update
// here on purpose — admin accounts are managed elsewhere; this service only
// authenticates against them.
@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.client.admin.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  findByIdentifier(identifier: string) {
    return this.prisma.client.admin.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      include: { role: true },
    });
  }

  toPublicProfile(admin: {
    id: string;
    username: string;
    email: string;
    isActive: boolean;
    sitecode: string | null;
    createdAt: Date;
    role: { id: string; name: string; level: number } | null;
  }) {
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      isActive: admin.isActive,
      sitecode: admin.sitecode,
      createdAt: admin.createdAt,
      role: admin.role
        ? { id: admin.role.id, name: admin.role.name, level: admin.role.level }
        : null,
    };
  }
}
