import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DEVICE_ITEM_STATUS } from "../device-items/device-item-status";
import { PrismaService } from "../prisma/prisma.service";
import { ASSIGNMENT_STATUS } from "./assignment-status";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { QueryAssignmentsDto } from "./dto/query-assignments.dto";
import { ReturnAssignmentDto } from "./dto/return-assignment.dto";

const assignmentInclude = {
  deviceItem: {
    select: {
      id: true,
      serialNumber: true,
      status: true,
      device: {
        select: {
          id: true,
          name: true,
          imagePath: true,
        },
      },
    },
  },
} satisfies Prisma.AssignmentInclude;

export type AssignmentResponse = Prisma.AssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createAssignmentDto: CreateAssignmentDto,
  ): Promise<AssignmentResponse> {
    const receivedBy = createAssignmentDto.receivedBy.trim();
    const notes = this.normalizeOptionalText(createAssignmentDto.notes);

    if (!receivedBy) {
      throw new BadRequestException("receivedBy must not be empty");
    }

    return this.prisma.$transaction(async (tx) => {
      const deviceItem = await tx.deviceItem.findUnique({
        where: { id: createAssignmentDto.deviceItemId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!deviceItem) {
        throw new NotFoundException("Device item not found");
      }

      if (deviceItem.status !== DEVICE_ITEM_STATUS.AVAILABLE) {
        throw new ConflictException(
          "Device item is not available for assignment",
        );
      }

      const claimedItem = await tx.deviceItem.updateMany({
        where: {
          id: deviceItem.id,
          status: DEVICE_ITEM_STATUS.AVAILABLE,
        },
        data: {
          status: DEVICE_ITEM_STATUS.ASSIGNED,
        },
      });

      if (claimedItem.count !== 1) {
        throw new ConflictException(
          "Device item is not available for assignment",
        );
      }

      const activeAssignment = await tx.assignment.findFirst({
        where: {
          deviceItemId: deviceItem.id,
          status: ASSIGNMENT_STATUS.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      if (activeAssignment) {
        throw new ConflictException(
          "Device item already has an active assignment",
        );
      }

      const assignment = await tx.assignment.create({
        data: {
          deviceItemId: deviceItem.id,
          receivedBy,
          assignedAt: new Date(),
          status: ASSIGNMENT_STATUS.ACTIVE,
          notes,
        },
        select: {
          id: true,
        },
      });

      return tx.assignment.findUniqueOrThrow({
        where: { id: assignment.id },
        include: assignmentInclude,
      });
    });
  }

  findAll(query: QueryAssignmentsDto): Promise<AssignmentResponse[]> {
    return this.prisma.assignment.findMany({
      where: query.status
        ? {
            status: query.status,
          }
        : undefined,
      include: assignmentInclude,
      orderBy: {
        assignedAt: "desc",
      },
    });
  }

  async findOne(id: number): Promise<AssignmentResponse> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });

    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    return assignment;
  }

  async returnAssignment(
    id: number,
    returnAssignmentDto: ReturnAssignmentDto,
  ): Promise<AssignmentResponse> {
    const returnNotes = this.normalizeOptionalText(
      returnAssignmentDto.returnNotes,
    );

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.findUnique({
        where: { id },
        include: {
          deviceItem: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new NotFoundException("Assignment not found");
      }

      if (assignment.status === ASSIGNMENT_STATUS.RETURNED) {
        throw new BadRequestException("Assignment has already been returned");
      }

      if (assignment.status !== ASSIGNMENT_STATUS.ACTIVE) {
        throw new BadRequestException(
          "Only active assignments can be returned",
        );
      }

      if (!assignment.deviceItem) {
        throw new NotFoundException("Linked device item not found");
      }

      if (assignment.deviceItem.status !== DEVICE_ITEM_STATUS.ASSIGNED) {
        throw new ConflictException("Linked device item is not assigned");
      }

      await tx.assignment.update({
        where: { id },
        data: {
          status: ASSIGNMENT_STATUS.RETURNED,
          returnedAt: new Date(),
          returnNotes,
        },
      });

      await tx.deviceItem.update({
        where: { id: assignment.deviceItem.id },
        data: {
          status: DEVICE_ITEM_STATUS.AVAILABLE,
        },
      });

      return tx.assignment.findUniqueOrThrow({
        where: { id },
        include: assignmentInclude,
      });
    });
  }

  private normalizeOptionalText(value?: string): string | null {
    if (value === undefined) {
      return null;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }
}
