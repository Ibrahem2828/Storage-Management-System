import { Module } from "@nestjs/common";
import { DevicesModule } from "../devices/devices.module";
import { DeviceItemsController } from "./device-items.controller";
import { DeviceItemsService } from "./device-items.service";

@Module({
  imports: [DevicesModule],
  controllers: [DeviceItemsController],
  providers: [DeviceItemsService],
})
export class DeviceItemsModule {}
