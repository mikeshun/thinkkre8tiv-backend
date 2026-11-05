import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { Role } from "src/enum/role.enum";

export class SearchEmployeeDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'General search term (name or email)' })
    q?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by first or last name' })
    name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by email address' })
    email?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, enum: Role, description: 'Filter by role' })
    role?: Role;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by phone number' })
    phone?: string;
}
