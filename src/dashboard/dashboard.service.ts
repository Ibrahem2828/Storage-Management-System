import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ASSIGNMENT_STATUS } from "../assignments/assignment-status";
import { DEVICE_ITEM_STATUS } from "../device-items/device-item-status";
import { PrismaService } from "../prisma/prisma.service";

const recentAssignmentSelect = {
  id: true,
  status: true,
  receivedBy: true,
  assignedAt: true,
  returnedAt: true,
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
} satisfies Prisma.AssignmentSelect;

export interface DashboardSummary {
  devicesCount: number;
  deviceItemsCount: number;
  availableItemsCount: number;
  assignedItemsCount: number;
  activeAssignmentsCount: number;
  returnedAssignmentsCount: number;
}

export type RecentAssignmentResponse = Prisma.AssignmentGetPayload<{
  select: typeof recentAssignmentSelect;
}>;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummary> {
    const [
      devicesCount,
      deviceItemsCount,
      availableItemsCount,
      assignedItemsCount,
      activeAssignmentsCount,
      returnedAssignmentsCount,
    ] = await this.prisma.$transaction([
      this.prisma.device.count(),
      this.prisma.deviceItem.count(),
      this.prisma.deviceItem.count({
        where: {
          status: DEVICE_ITEM_STATUS.AVAILABLE,
        },
      }),
      this.prisma.deviceItem.count({
        where: {
          status: DEVICE_ITEM_STATUS.ASSIGNED,
        },
      }),
      this.prisma.assignment.count({
        where: {
          status: ASSIGNMENT_STATUS.ACTIVE,
        },
      }),
      this.prisma.assignment.count({
        where: {
          status: ASSIGNMENT_STATUS.RETURNED,
        },
      }),
    ]);

    return {
      devicesCount,
      deviceItemsCount,
      availableItemsCount,
      assignedItemsCount,
      activeAssignmentsCount,
      returnedAssignmentsCount,
    };
  }

  getRecentAssignments(): Promise<RecentAssignmentResponse[]> {
    return this.prisma.assignment.findMany({
      orderBy: {
        assignedAt: "desc",
      },
      take: 10,
      select: recentAssignmentSelect,
    });
  }
}
