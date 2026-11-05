import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export class SearchInventoryDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'General search term (name)' })
    q?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by item name' })
    name?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @ApiProperty({ required: false, description: 'Minimum quantity in stock' })
    minQuantity?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @ApiProperty({ required: false, description: 'Maximum quantity in stock' })
    maxQuantity?: number;
}
