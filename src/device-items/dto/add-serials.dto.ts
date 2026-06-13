import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class AddSerialsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serialNumbers: string[];
}
