import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { DatabaseService } from "../common/database/database.service";
import {
  isSqliteConstraintError,
  toIsoTimestamp,
} from "../common/database/database.utils";
import { DevicesService } from "../devices/devices.service";
import { DEVICE_ITEM_STATUS } from "./device-item-status";
import { DeviceItemResponse } from "./device-item.types";

interface DeviceItemRow {
  id: number;
  deviceId: number;
  serialNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

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
export class DeviceItemsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly devicesService: DevicesService,
  ) {}

  addSerialNumbers(
    deviceId: number,
    serialNumbers: string[],
  ): DeviceItemResponse[] {
    this.devicesService.ensureExists(deviceId);

    const normalizedSerialNumbers = serialNumbers.map((serialNumber) =>
      serialNumber.trim(),
    );

    if (normalizedSerialNumbers.some((serialNumber) => !serialNumber)) {
      throw new BadRequestException("Serial numbers cannot be empty");
    }

    if (
      new Set(normalizedSerialNumbers).size !== normalizedSerialNumbers.length
    ) {
      throw new BadRequestException(
        "Duplicate serial numbers are not allowed in the request body",
      );
    }

    const placeholders = normalizedSerialNumbers.map(() => "?").join(", ");
    const existingSerials = this.database.all<{ serialNumber: string }>(
      `SELECT serial_number AS serialNumber
       FROM device_items
       WHERE serial_number IN (${placeholders})`,
      normalizedSerialNumbers,
    );

    if (existingSerials.length > 0) {
      throw new ConflictException("Some serial numbers already exist");
    }

    try {
      return this.database.transaction(() => {
        const createdIds = normalizedSerialNumbers.map((serialNumber) => {
          const result = this.database.run(
            `INSERT INTO device_items (device_id, serial_number, status)
             VALUES (?, ?, ?)`,
            [deviceId, serialNumber, DEVICE_ITEM_STATUS.AVAILABLE],
          );

          return Number(result.lastInsertRowid);
        });

        const createdPlaceholders = createdIds.map(() => "?").join(", ");

        return this.database
          .all<DeviceItemRow>(
            `${deviceItemSelect}
             WHERE id IN (${createdPlaceholders})
             ORDER BY created_at DESC, id DESC`,
            createdIds,
          )
          .map((row) => this.toDeviceItem(row));
      });
    } catch (error) {
      if (isSqliteConstraintError(error)) {
        throw new ConflictException("One or more serial numbers already exist");
      }

      throw error;
    }
  }

  findForDevice(deviceId: number): DeviceItemResponse[] {
    this.devicesService.ensureExists(deviceId);

    return this.database
      .all<DeviceItemRow>(
        `${deviceItemSelect}
         WHERE device_id = ?
         ORDER BY created_at DESC, id DESC`,
        [deviceId],
      )
      .map((row) => this.toDeviceItem(row));
  }

  private toDeviceItem(row: DeviceItemRow): DeviceItemResponse {
    return {
      ...row,
      createdAt: toIsoTimestamp(row.createdAt),
      updatedAt: toIsoTimestamp(row.updatedAt),
    };
  }
}
