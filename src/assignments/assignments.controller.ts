import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { successResponse } from "../common/api-response";
import { ParseIdPipe } from "../common/parse-id.pipe";
import { AssignmentsService } from "./assignments.service";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { QueryAssignmentsDto } from "./dto/query-assignments.dto";
import { ReturnAssignmentDto } from "./dto/return-assignment.dto";

@Controller("assignments")
@UseGuards(JwtAuthGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  async create(@Body() createAssignmentDto: CreateAssignmentDto) {
    const assignment =
      await this.assignmentsService.create(createAssignmentDto);

    return successResponse("Device assigned successfully", assignment);
  }

  @Get()
  async findAll(@Query() query: QueryAssignmentsDto) {
    const assignments = await this.assignmentsService.findAll(query);

    return successResponse("Assignments retrieved successfully", assignments);
  }

  @Post(":id/return")
  async returnAssignment(
    @Param("id", ParseIdPipe) id: number,
    @Body() returnAssignmentDto: ReturnAssignmentDto,
  ) {
    const assignment = await this.assignmentsService.returnAssignment(
      id,
      returnAssignmentDto,
    );

    return successResponse("Device returned successfully", assignment);
  }

  @Get(":id")
  async findOne(@Param("id", ParseIdPipe) id: number) {
    const assignment = await this.assignmentsService.findOne(id);

    return successResponse("Assignment retrieved successfully", assignment);
  }
}
