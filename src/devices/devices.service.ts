import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ASSIGNMENT_STATUS } from "../assignments/assignment-status";
import { PrismaService } from "../prisma/prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UpdateDeviceDto } from "./dto/update-device.dto";

const deviceListInclude = {
  items: {
    orderBy: {
      createdAt: "desc",
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.DeviceInclude;

const activeAssignmentSelect = {
  id: true,
  status: true,
  receivedBy: true,
  assignedAt: true,
  returnedAt: true,
  notes: true,
  returnNotes: true,
} satisfies Prisma.AssignmentSelect;

const deviceDetailInclude = {
  items: {
    orderBy: {
      createdAt: "desc",
    },
    include: {
      assignments: {
        where: {
          status: ASSIGNMENT_STATUS.ACTIVE,
        },
        orderBy: {
          assignedAt: "desc",
        },
        take: 1,
        select: activeAssignmentSelect,
      },
    },
  },
  _count: {
    select: {
      items: true,
    },
  },
} satisfies Prisma.DeviceInclude;

const deviceAssignmentsInclude = {
  items: {
    orderBy: {
      createdAt: "desc",
    },
    include: {
      assignments: {
        orderBy: {
          assignedAt: "desc",
        },
        select: {
          id: true,
          status: true,
          receivedBy: true,
          assignedAt: true,
          returnedAt: true,
          notes: true,
          returnNotes: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.DeviceInclude;

type DeviceListRecord = Prisma.DeviceGetPayload<{
  include: typeof deviceListInclude;
}>;

type DeviceDetailRecord = Prisma.DeviceGetPayload<{
  include: typeof deviceDetailInclude;
}>;

type DeviceAssignmentsRecord = Prisma.DeviceGetPayload<{
  include: typeof deviceAssignmentsInclude;
}>;

type DeviceItemRecord = DeviceListRecord["items"][number];
type DeviceActiveAssignment =
  DeviceDetailRecord["items"][number]["assignments"][number];
type DeviceAssignmentHistory =
  DeviceAssignmentsRecord["items"][number]["assignments"][number];

export interface DeviceListResponse {
  id: number;
  name: string;
  details: string | null;
  imagePath: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemsCount: number;
  items: DeviceItemRecord[];
}

export interface DeviceDetailResponse extends Omit<
  DeviceListResponse,
  "items"
> {
  items: Array<
    DeviceItemRecord & {
      latestActiveAssignment: DeviceActiveAssignment | null;
    }
  >;
}

export interface DeviceAssignmentsResponse {
  device: {
    id: number;
    name: string;
    details: string | null;
    imagePath: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  deviceItems: Array<
    DeviceItemRecord & {
      assignments: DeviceAssignmentHistory[];
    }
  >;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  async create(createDeviceDto: CreateDeviceDto): Promise<DeviceListResponse> {
    const name = createDeviceDto.name.trim();

    if (!name) {
      throw new BadRequestException("Device name must not be empty");
    }

    const device = await this.prisma.device.create({
      data: {
        name,
        details: this.normalizeOptionalText(createDeviceDto.details),
      },
      include: deviceListInclude,
    });

    return this.toDeviceListResponse(device);
  }

  async findAll(): Promise<DeviceListResponse[]> {
    const devices = await this.prisma.device.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: deviceListInclude,
    });

    return devices.map((device) => this.toDeviceListResponse(device));
  }

  async findOne(id: number): Promise<DeviceDetailResponse> {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: deviceDetailInclude,
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} was not found`);
    }

    return this.toDeviceDetailResponse(device);
  }

  async update(
    id: number,
    updateDeviceDto: UpdateDeviceDto,
  ): Promise<DeviceListResponse> {
    await this.ensureExists(id);

    const name =
      updateDeviceDto.name !== undefined
        ? updateDeviceDto.name.trim()
        : undefined;

    if (name !== undefined && !name) {
      throw new BadRequestException("Device name must not be empty");
    }

    const device = await this.prisma.device.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(updateDeviceDto.details !== undefined
          ? { details: this.normalizeOptionalText(updateDeviceDto.details) }
          : {}),
      },
      include: deviceListInclude,
    });

    return this.toDeviceListResponse(device);
  }

  async updateImage(
    id: number,
    file: Express.Multer.File,
  ): Promise<DeviceListResponse> {
    await this.ensureExists(id);

    const device = await this.prisma.device.update({
      where: { id },
      data: {
        imagePath: this.uploadsService.getStoredDeviceImagePath(file.filename),
      },
      include: deviceListInclude,
    });

    return this.toDeviceListResponse(device);
  }

  async findAssignmentsForDevice(
    id: number,
  ): Promise<DeviceAssignmentsResponse> {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: deviceAssignmentsInclude,
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} was not found`);
    }

    return {
      device: {
        id: device.id,
        name: device.name,
        details: device.details,
        imagePath: device.imagePath,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      },
      deviceItems: device.items.map((item) => ({
        id: item.id,
        deviceId: item.deviceId,
        serialNumber: item.serialNumber,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        assignments: item.assignments,
      })),
    };
  }

  async ensureExists(id: number): Promise<void> {
    const count = await this.prisma.device.count({
      where: { id },
    });

    if (count === 0) {
      throw new NotFoundException(`Device with ID ${id} was not found`);
    }
  }

  private toDeviceListResponse(device: DeviceListRecord): DeviceListResponse {
    return {
      id: device.id,
      name: device.name,
      details: device.details,
      imagePath: device.imagePath,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      itemsCount: device._count.items,
      items: device.items,
    };
  }

  private toDeviceDetailResponse(
    device: DeviceDetailRecord,
  ): DeviceDetailResponse {
    return {
      id: device.id,
      name: device.name,
      details: device.details,
      imagePath: device.imagePath,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      itemsCount: device._count.items,
      items: device.items.map((item) => ({
        id: item.id,
        deviceId: item.deviceId,
        serialNumber: item.serialNumber,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        latestActiveAssignment: item.assignments[0] ?? null,
      })),
    };
  }

  private normalizeOptionalText(value?: string): string | null {
    if (value === undefined) {
      return null;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }
}
