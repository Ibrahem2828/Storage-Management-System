import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { successResponse } from "../common/api-response";
import { ParseIdPipe } from "../common/parse-id.pipe";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UpdateDeviceDto } from "./dto/update-device.dto";
import { DeviceDetailResponse, DevicesService } from "./devices.service";

@Controller("devices")
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  async create(@Body() createDeviceDto: CreateDeviceDto) {
    const device = await this.devicesService.create(createDeviceDto);

    return successResponse("Device created successfully", device);
  }

  @Get()
  async findAll() {
    const devices = await this.devicesService.findAll();

    return successResponse("Devices retrieved successfully", devices);
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseIdPipe) id: number,
  ): Promise<ReturnType<typeof successResponse<DeviceDetailResponse>>> {
    const device = await this.devicesService.findOne(id);

    return successResponse("Device retrieved successfully", device);
  }

  @Get(":id/assignments")
  async findAssignmentsForDevice(@Param("id", ParseIdPipe) id: number) {
    const assignments = await this.devicesService.findAssignmentsForDevice(id);

    return successResponse(
      "Device assignment history retrieved successfully",
      assignments,
    );
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIdPipe) id: number,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    const device = await this.devicesService.update(id, updateDeviceDto);

    return successResponse("Device updated successfully", device);
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("image"))
  async uploadImage(
    @Param("id", ParseIdPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Image file is required");
    }

    const device = await this.devicesService.updateImage(id, file);

    return successResponse("Device image uploaded successfully", device);
  }
}
