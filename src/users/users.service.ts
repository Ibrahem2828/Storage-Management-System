import { Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { SafeUser } from "./user.types";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createDefaultAdmin(): Promise<void> {
    const username = "admin";
    const passwordHash = await bcrypt.hash("admin123", 12);

    await this.prisma.user.upsert({
      where: { username },
      create: {
        name: "Warehouse Manager",
        username,
        passwordHash,
      },
      update: {},
    });
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
