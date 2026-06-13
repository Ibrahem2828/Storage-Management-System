import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { successResponse } from "../common/api-response";
import { ParseIdPipe } from "../common/parse-id.pipe";
import { AddSerialsDto } from "./dto/add-serials.dto";
import { DeviceItemsService } from "./device-items.service";

@Controller("devices/:deviceId/serials")
@UseGuards(JwtAuthGuard)
export class DeviceItemsController {
  constructor(private readonly deviceItemsService: DeviceItemsService) {}

  @Post()
  async addSerialNumbers(
    @Param("deviceId", ParseIdPipe) deviceId: number,
    @Body() addSerialsDto: AddSerialsDto,
  ) {
    const serials = await this.deviceItemsService.addSerialNumbers(
      deviceId,
      addSerialsDto.serialNumbers,
    );

    return successResponse("Serial numbers added successfully", serials);
  }

  @Get()
  async findForDevice(@Param("deviceId", ParseIdPipe) deviceId: number) {
    const serials = await this.deviceItemsService.findForDevice(deviceId);

    return successResponse("Serial numbers retrieved successfully", serials);
  }
}
