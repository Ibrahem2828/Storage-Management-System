import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  details?: string;
}
