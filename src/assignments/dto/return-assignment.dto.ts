import { IsOptional, IsString } from "class-validator";

export class ReturnAssignmentDto {
  @IsString()
  @IsOptional()
  returnNotes?: string;
}
