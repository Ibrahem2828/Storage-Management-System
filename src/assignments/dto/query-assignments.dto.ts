import { IsIn, IsOptional } from "class-validator";
import { ASSIGNMENT_STATUSES, AssignmentStatus } from "../assignment-status";

export class QueryAssignmentsDto {
  @IsOptional()
  @IsIn(ASSIGNMENT_STATUSES)
  status?: AssignmentStatus;
}
