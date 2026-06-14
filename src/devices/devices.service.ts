import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ASSIGNMENT_STATUS } from "../assignments/assignment-status";
import { DatabaseService } from "../common/database/database.service";
import { toIsoTimestamp } from "../common/database/database.utils";
import { DeviceItemResponse } from "../device-items/device-item.types";
import { UploadsService } from "../uploads/uploads.service";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UpdateDeviceDto } from "./dto/update-device.dto";

interface DeviceRow {
  id: number;
  name: string;
  details: string | null;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
}

interface DeviceItemRow {
  id: number;
  deviceId: number;
  serialNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AssignmentRow {
  id: number;
  deviceItemId: number;
  status: string;
  receivedBy: string;
  assignedAt: string;
  returnedAt: string | null;
  notes: string | null;
  returnNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceActiveAssignment {
  id: number;
  status: string;
  receivedBy: string;
  assignedAt: string;
  returnedAt: string | null;
  notes: string | null;
  returnNotes: string | null;
}

export interface DeviceAssignmentHistory extends DeviceActiveAssignment {
  createdAt: string;
  updatedAt: string;
}

export interface DeviceListResponse {
  id: number;
  name: string;
  details: string | null;
  imagePath: string | null;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
  items: DeviceItemResponse[];
}

export interface DeviceDetailResponse extends Omit<
  DeviceListResponse,
  "items"
> {
  items: Array<
    DeviceItemResponse & {
      latestActiveAssignment: DeviceActiveAssignment | null;
    }
  >;
}

export interface DeviceAssignmentsResponse {
  device: Omit<DeviceListResponse, "itemsCount" | "items">;
  deviceItems: Array<
    DeviceItemResponse & {
      assignments: DeviceAssignmentHistory[];
    }
  >;
}

const deviceSelect = `
  SELECT
    d.id,
    d.name,
    d.details,
    d.image_path AS imagePath,
    d.created_at AS createdAt,
    d.updated_at AS updatedAt,
    COUNT(di.id) AS itemsCount
  FROM devices d
  LEFT JOIN device_items di ON di.device_id = d.id
`;

const deviceItemSelect = `
  SELECT
    id,
    device_id AS deviceId,
    serial_number AS serialNumber,
    status,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM device_items
`;

@Injectable()
export class DevicesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly uploadsService: UploadsService,
  ) {}

  create(createDeviceDto: CreateDeviceDto): DeviceListResponse {
    const name = createDeviceDto.name.trim();

    if (!name) {
      throw new BadRequestException("Device name must not be empty");
    }

    const result = this.database.run(
      "INSERT INTO devices (name, details) VALUES (?, ?)",
      [name, this.normalizeOptionalText(createDeviceDto.details)],
    );

    return this.findListRecord(Number(result.lastInsertRowid));
  }

  findAll(): DeviceListResponse[] {
    return this.database
      .all<DeviceRow>(
        `${deviceSelect}
         GROUP BY d.id
         ORDER BY d.created_at DESC, d.id DESC`,
      )
      .map((row) => this.toDeviceListResponse(row));
  }

  findOne(id: number): DeviceDetailResponse {
    const device = this.findDeviceRow(id);
    const items = this.findItemRows(id).map((item) => {
      const assignment = this.database.get<AssignmentRow>(
        `SELECT
           id,
           device_item_id AS deviceItemId,
           status,
           received_by AS receivedBy,
           assigned_at AS assignedAt,
           returned_at AS returnedAt,
           notes,
           return_notes AS returnNotes,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM assignments
         WHERE device_item_id = ? AND status = ?
         ORDER BY assigned_at DESC, id DESC
         LIMIT 1`,
        [item.id, ASSIGNMENT_STATUS.ACTIVE],
      );

      return {
        ...this.toDeviceItem(item),
        latestActiveAssignment: assignment
          ? this.toActiveAssignment(assignment)
          : null,
      };
    });

    return {
      ...this.toDeviceBase(device),
      itemsCount: device.itemsCount,
      items,
    };
  }

  update(id: number, updateDeviceDto: UpdateDeviceDto): DeviceListResponse {
    this.ensureExists(id);

    const updates: string[] = [];
    const params: Array<string | null | number> = [];

    if (updateDeviceDto.name !== undefined) {
      const name = updateDeviceDto.name.trim();

      if (!name) {
        throw new BadRequestException("Device name must not be empty");
      }

      updates.push("name = ?");
      params.push(name);
    }

    if (updateDeviceDto.details !== undefined) {
      updates.push("details = ?");
      params.push(this.normalizeOptionalText(updateDeviceDto.details));
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    this.database.run(
      `UPDATE devices SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    return this.findListRecord(id);
  }

  updateImage(id: number, file: Express.Multer.File): DeviceListResponse {
    this.ensureExists(id);

    this.database.run(
      `UPDATE devices
       SET image_path = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [this.uploadsService.getStoredDeviceImagePath(file.filename), id],
    );

    return this.findListRecord(id);
  }

  findAssignmentsForDevice(id: number): DeviceAssignmentsResponse {
    const device = this.findDeviceRow(id);
    const items = this.findItemRows(id);
    const assignments = this.database.all<AssignmentRow>(
      `SELECT
         a.id,
         a.device_item_id AS deviceItemId,
         a.status,
         a.received_by AS receivedBy,
         a.assigned_at AS assignedAt,
         a.returned_at AS returnedAt,
         a.notes,
         a.return_notes AS returnNotes,
         a.created_at AS createdAt,
         a.updated_at AS updatedAt
       FROM assignments a
       INNER JOIN device_items di ON di.id = a.device_item_id
       WHERE di.device_id = ?
       ORDER BY a.assigned_at DESC, a.id DESC`,
      [id],
    );

    return {
      device: this.toDeviceBase(device),
      deviceItems: items.map((item) => ({
        ...this.toDeviceItem(item),
        assignments: assignments
          .filter((assignment) => assignment.deviceItemId === item.id)
          .map((assignment) => this.toAssignmentHistory(assignment)),
      })),
    };
  }

  ensureExists(id: number): void {
    const device = this.database.get<{ id: number }>(
      "SELECT id FROM devices WHERE id = ?",
      [id],
    );

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} was not found`);
    }
  }

  private findListRecord(id: number): DeviceListResponse {
    return this.toDeviceListResponse(this.findDeviceRow(id));
  }

  private findDeviceRow(id: number): DeviceRow {
    const device = this.database.get<DeviceRow>(
      `${deviceSelect}
       WHERE d.id = ?
       GROUP BY d.id`,
      [id],
    );

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} was not found`);
    }

    return device;
  }

  private findItemRows(deviceId: number): DeviceItemRow[] {
    return this.database.all<DeviceItemRow>(
      `${deviceItemSelect}
       WHERE device_id = ?
       ORDER BY created_at DESC, id DESC`,
      [deviceId],
    );
  }

  private toDeviceListResponse(row: DeviceRow): DeviceListResponse {
    return {
      ...this.toDeviceBase(row),
      itemsCount: row.itemsCount,
      items: this.findItemRows(row.id).map((item) => this.toDeviceItem(item)),
    };
  }

  private toDeviceBase(row: DeviceRow) {
    return {
      id: row.id,
      name: row.name,
      details: row.details,
      imagePath: row.imagePath,
      createdAt: toIsoTimestamp(row.createdAt),
      updatedAt: toIsoTimestamp(row.updatedAt),
    };
  }

  private toDeviceItem(row: DeviceItemRow): DeviceItemResponse {
    return {
      ...row,
      createdAt: toIsoTimestamp(row.createdAt),
      updatedAt: toIsoTimestamp(row.updatedAt),
    };
  }

  private toActiveAssignment(row: AssignmentRow): DeviceActiveAssignment {
    return {
      id: row.id,
      status: row.status,
      receivedBy: row.receivedBy,
      assignedAt: toIsoTimestamp(row.assignedAt),
      returnedAt: row.returnedAt ? toIsoTimestamp(row.returnedAt) : null,
      notes: row.notes,
      returnNotes: row.returnNotes,
    };
  }

  private toAssignmentHistory(row: AssignmentRow): DeviceAssignmentHistory {
    return {
      ...this.toActiveAssignment(row),
      createdAt: toIsoTimestamp(row.createdAt),
      updatedAt: toIsoTimestamp(row.updatedAt),
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
