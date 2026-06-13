export const DEVICE_ITEM_STATUS = {
  AVAILABLE: "AVAILABLE",
  ASSIGNED: "ASSIGNED",
} as const;

export type DeviceItemStatus =
  (typeof DEVICE_ITEM_STATUS)[keyof typeof DEVICE_ITEM_STATUS];
