import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DevicesService } from "../devices/devices.service";
import { DEVICE_ITEM_STATUS } from "./device-item-status";

const deviceItemSelect = {
  id: true,
  deviceId: true,
  serialNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeviceItemSelect;

export type DeviceItemResponse = Prisma.DeviceItemGetPayload<{
  select: typeof deviceItemSelect;
}>;

@Injectable()
export class DeviceItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesService: DevicesService,
  ) {}

  async addSerialNumbers(
    deviceId: number,
    serialNumbers: string[],
  ): Promise<DeviceItemResponse[]> {
    await this.devicesService.ensureExists(deviceId);

    const normalizedSerialNumbers = serialNumbers.map((serialNumber) =>
      serialNumber.trim(),
    );

    const emptySerialsExist = normalizedSerialNumbers.some(
      (serialNumber) => serialNumber.length === 0,
    );

    if (emptySerialsExist) {
      throw new BadRequestException("Serial numbers cannot be empty");
    }

    const uniqueSerialNumbers = new Set(normalizedSerialNumbers);

    if (uniqueSerialNumbers.size !== normalizedSerialNumbers.length) {
      throw new BadRequestException(
        "Duplicate serial numbers are not allowed in the request body",
      );
    }

    const existingSerials = await this.prisma.deviceItem.findMany({
      where: {
        serialNumber: {
          in: normalizedSerialNumbers,
        },
      },
      select: {
        serialNumber: true,
      },
    });

    if (existingSerials.length > 0) {
      throw new ConflictException({
        message: "Some serial numbers already exist",
        serialNumbers: existingSerials.map((item) => item.serialNumber),
      });
    }

    try {
      return await this.prisma.$transaction(
        normalizedSerialNumbers.map((serialNumber) =>
          this.prisma.deviceItem.create({
            data: {
              deviceId,
              serialNumber,
              status: DEVICE_ITEM_STATUS.AVAILABLE,
            },
            select: deviceItemSelect,
          }),
        ),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("One or more serial numbers already exist");
      }

      throw error;
    }
  }

  async findForDevice(deviceId: number): Promise<DeviceItemResponse[]> {
    await this.devicesService.ensureExists(deviceId);

    return this.prisma.deviceItem.findMany({
      where: {
        deviceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: deviceItemSelect,
    });
  }
}
