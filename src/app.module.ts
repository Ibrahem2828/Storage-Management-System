import { Module, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AssignmentsModule } from "./assignments/assignments.module";
import { AuthModule } from "./auth/auth.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DevicesModule } from "./devices/devices.module";
import { DeviceItemsModule } from "./device-items/device-items.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { UsersService } from "./users/users.service";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    DevicesModule,
    DeviceItemsModule,
    AssignmentsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly usersService: UsersService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.usersService.createDefaultAdmin();
  }
}
