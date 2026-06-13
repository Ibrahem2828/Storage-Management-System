import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreateAssignmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deviceItemId: number;

  @IsString()
  @IsNotEmpty()
  receivedBy: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
