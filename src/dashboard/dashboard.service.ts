import { Injectable } from "@nestjs/common";
import { ASSIGNMENT_STATUS } from "../assignments/assignment-status";
import { DatabaseService } from "../common/database/database.service";
import { toIsoTimestamp } from "../common/database/database.utils";
import { DEVICE_ITEM_STATUS } from "../device-items/device-item-status";

export interface DashboardSummary {
  devicesCount: number;
  deviceItemsCount: number;
  availableItemsCount: number;
  assignedItemsCount: number;
  activeAssignmentsCount: number;
  returnedAssignmentsCount: number;
}

interface RecentAssignmentRow {
  id: number;
  status: string;
  receivedBy: string;
  assignedAt: string;
  returnedAt: string | null;
  itemId: number;
  serialNumber: string;
  itemStatus: string;
  deviceId: number;
  deviceName: string;
  deviceImagePath: string | null;
}

export interface RecentAssignmentResponse {
  id: number;
  status: string;
  receivedBy: string;
  assignedAt: string;
  returnedAt: string | null;
  deviceItem: {
    id: number;
    serialNumber: string;
    status: string;
    device: {
      id: number;
      name: string;
      imagePath: string | null;
    };
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  getSummary(): DashboardSummary {
    const summary = this.database.get<DashboardSummary>(
      `SELECT
         (SELECT COUNT(*) FROM devices) AS devicesCount,
         (SELECT COUNT(*) FROM device_items) AS deviceItemsCount,
         (SELECT COUNT(*) FROM device_items WHERE status = ?) AS availableItemsCount,
         (SELECT COUNT(*) FROM device_items WHERE status = ?) AS assignedItemsCount,
         (SELECT COUNT(*) FROM assignments WHERE status = ?) AS activeAssignmentsCount,
         (SELECT COUNT(*) FROM assignments WHERE status = ?) AS returnedAssignmentsCount`,
      [
        DEVICE_ITEM_STATUS.AVAILABLE,
        DEVICE_ITEM_STATUS.ASSIGNED,
        ASSIGNMENT_STATUS.ACTIVE,
        ASSIGNMENT_STATUS.RETURNED,
      ],
    );

    return (
      summary ?? {
        devicesCount: 0,
        deviceItemsCount: 0,
        availableItemsCount: 0,
        assignedItemsCount: 0,
        activeAssignmentsCount: 0,
        returnedAssignmentsCount: 0,
      }
    );
  }

  getRecentAssignments(): RecentAssignmentResponse[] {
    return this.database
      .all<RecentAssignmentRow>(
        `SELECT
           a.id,
           a.status,
           a.received_by AS receivedBy,
           a.assigned_at AS assignedAt,
           a.returned_at AS returnedAt,
           di.id AS itemId,
           di.serial_number AS serialNumber,
           di.status AS itemStatus,
           d.id AS deviceId,
           d.name AS deviceName,
           d.image_path AS deviceImagePath
         FROM assignments a
         INNER JOIN device_items di ON di.id = a.device_item_id
         INNER JOIN devices d ON d.id = di.device_id
         ORDER BY a.assigned_at DESC, a.id DESC
         LIMIT 10`,
      )
      .map((row) => ({
        id: row.id,
        status: row.status,
        receivedBy: row.receivedBy,
        assignedAt: toIsoTimestamp(row.assignedAt),
        returnedAt: row.returnedAt ? toIsoTimestamp(row.returnedAt) : null,
        deviceItem: {
          id: row.itemId,
          serialNumber: row.serialNumber,
          status: row.itemStatus,
          device: {
            id: row.deviceId,
            name: row.deviceName,
            imagePath: row.deviceImagePath,
          },
        },
      }));
  }
}
