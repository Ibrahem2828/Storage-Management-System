import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../common/database/database.service";
import {
  isSqliteConstraintError,
  toIsoTimestamp,
} from "../common/database/database.utils";
import { DEVICE_ITEM_STATUS } from "../device-items/device-item-status";
import { ASSIGNMENT_STATUS } from "./assignment-status";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { QueryAssignmentsDto } from "./dto/query-assignments.dto";
import { ReturnAssignmentDto } from "./dto/return-assignment.dto";

interface DeviceItemStatusRow {
  id: number;
  status: string;
}

interface AssignmentRow {
  id: number;
  deviceItemId: number;
  receivedBy: string;
  assignedAt: string;
  returnedAt: string | null;
  status: string;
  notes: string | null;
  returnNotes: string | null;
  createdAt: string;
  updatedAt: string;
  itemId: number;
  serialNumber: string;
  itemStatus: string;
  deviceId: number;
  deviceName: string;
  deviceImagePath: string | null;
}

export interface AssignmentResponse {
  id: number;
  deviceItemId: number;
  receivedBy: string;
  assignedAt: string;
  returnedAt: string | null;
  status: string;
  notes: string | null;
  returnNotes: string | null;
  createdAt: string;
  updatedAt: string;
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

const assignmentSelect = `
  SELECT
    a.id,
    a.device_item_id AS deviceItemId,
    a.received_by AS receivedBy,
    a.assigned_at AS assignedAt,
    a.returned_at AS returnedAt,
    a.status,
    a.notes,
    a.return_notes AS returnNotes,
    a.created_at AS createdAt,
    a.updated_at AS updatedAt,
    di.id AS itemId,
    di.serial_number AS serialNumber,
    di.status AS itemStatus,
    d.id AS deviceId,
    d.name AS deviceName,
    d.image_path AS deviceImagePath
  FROM assignments a
  INNER JOIN device_items di ON di.id = a.device_item_id
  INNER JOIN devices d ON d.id = di.device_id
`;

@Injectable()
export class AssignmentsService {
  constructor(private readonly database: DatabaseService) {}

  create(createAssignmentDto: CreateAssignmentDto): AssignmentResponse {
    const receivedBy = createAssignmentDto.receivedBy.trim();

    if (!receivedBy) {
      throw new BadRequestException("receivedBy must not be empty");
    }

    try {
      return this.database.transaction(() => {
        const deviceItem = this.database.get<DeviceItemStatusRow>(
          "SELECT id, status FROM device_items WHERE id = ?",
          [createAssignmentDto.deviceItemId],
        );

        if (!deviceItem) {
          throw new NotFoundException("Device item not found");
        }

        if (deviceItem.status !== DEVICE_ITEM_STATUS.AVAILABLE) {
          throw new ConflictException(
            "Device item is not available for assignment",
          );
        }

        const activeAssignment = this.database.get<{ id: number }>(
          `SELECT id FROM assignments
           WHERE device_item_id = ? AND status = ?`,
          [deviceItem.id, ASSIGNMENT_STATUS.ACTIVE],
        );

        if (activeAssignment) {
          throw new ConflictException(
            "Device item already has an active assignment",
          );
        }

        const claimedItem = this.database.run(
          `UPDATE device_items
           SET status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = ?`,
          [
            DEVICE_ITEM_STATUS.ASSIGNED,
            deviceItem.id,
            DEVICE_ITEM_STATUS.AVAILABLE,
          ],
        );

        if (claimedItem.changes !== 1) {
          throw new ConflictException(
            "Device item is not available for assignment",
          );
        }

        const assignment = this.database.run(
          `INSERT INTO assignments
             (device_item_id, received_by, notes, status)
           VALUES (?, ?, ?, ?)`,
          [
            deviceItem.id,
            receivedBy,
            this.normalizeOptionalText(createAssignmentDto.notes),
            ASSIGNMENT_STATUS.ACTIVE,
          ],
        );

        return this.findOneRecord(Number(assignment.lastInsertRowid));
      });
    } catch (error) {
      if (isSqliteConstraintError(error)) {
        throw new ConflictException(
          "Device item already has an active assignment",
        );
      }

      throw error;
    }
  }

  findAll(query: QueryAssignmentsDto): AssignmentResponse[] {
    const where = query.status ? "WHERE a.status = ?" : "";
    const params = query.status ? [query.status] : [];

    return this.database
      .all<AssignmentRow>(
        `${assignmentSelect}
         ${where}
         ORDER BY a.assigned_at DESC, a.id DESC`,
        params,
      )
      .map((row) => this.toAssignmentResponse(row));
  }

  findOne(id: number): AssignmentResponse {
    return this.findOneRecord(id);
  }

  returnAssignment(
    id: number,
    returnAssignmentDto: ReturnAssignmentDto,
  ): AssignmentResponse {
    return this.database.transaction(() => {
      const assignment = this.database.get<{
        id: number;
        deviceItemId: number;
        status: string;
        itemStatus: string;
      }>(
        `SELECT
           a.id,
           a.device_item_id AS deviceItemId,
           a.status,
           di.status AS itemStatus
         FROM assignments a
         INNER JOIN device_items di ON di.id = a.device_item_id
         WHERE a.id = ?`,
        [id],
      );

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

      if (assignment.itemStatus !== DEVICE_ITEM_STATUS.ASSIGNED) {
        throw new ConflictException("Linked device item is not assigned");
      }

      const returned = this.database.run(
        `UPDATE assignments
         SET
           status = ?,
           returned_at = CURRENT_TIMESTAMP,
           return_notes = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = ?`,
        [
          ASSIGNMENT_STATUS.RETURNED,
          this.normalizeOptionalText(returnAssignmentDto.returnNotes),
          id,
          ASSIGNMENT_STATUS.ACTIVE,
        ],
      );

      if (returned.changes !== 1) {
        throw new ConflictException("Assignment could not be returned");
      }

      const releasedItem = this.database.run(
        `UPDATE device_items
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = ?`,
        [
          DEVICE_ITEM_STATUS.AVAILABLE,
          assignment.deviceItemId,
          DEVICE_ITEM_STATUS.ASSIGNED,
        ],
      );

      if (releasedItem.changes !== 1) {
        throw new ConflictException("Linked device item is not assigned");
      }

      return this.findOneRecord(id);
    });
  }

  private findOneRecord(id: number): AssignmentResponse {
    const assignment = this.database.get<AssignmentRow>(
      `${assignmentSelect} WHERE a.id = ?`,
      [id],
    );

    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    return this.toAssignmentResponse(assignment);
  }

  private toAssignmentResponse(row: AssignmentRow): AssignmentResponse {
    return {
      id: row.id,
      deviceItemId: row.deviceItemId,
      receivedBy: row.receivedBy,
      assignedAt: toIsoTimestamp(row.assignedAt),
      returnedAt: row.returnedAt ? toIsoTimestamp(row.returnedAt) : null,
      status: row.status,
      notes: row.notes,
      returnNotes: row.returnNotes,
      createdAt: toIsoTimestamp(row.createdAt),
      updatedAt: toIsoTimestamp(row.updatedAt),
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
