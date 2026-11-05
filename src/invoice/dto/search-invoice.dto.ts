import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsEnum, IsDateString } from "class-validator";
import { Status } from "src/enum/invoice.enum";

export class SearchInvoiceDto {
    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'General search term (ID, name, or title)' })
    q?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by Invoice ID (e.g., HRM...)' })
    invoiceId?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by client name' })
    clientName?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by client email' })
    clientEmail?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Search by invoice title' })
    title?: string;

    @IsOptional()
    @IsEnum(Status)
    @ApiProperty({ required: false, enum: Status, description: 'Filter by invoice status' })
    status?: Status;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ required: false, description: 'Filter by start date (YYYY-MM-DD)' })
    startDate?: string;

    @IsOptional()
    @IsDateString()
    @ApiProperty({ required: false, description: 'Filter by end date (YYYY-MM-DD)' })
    endDate?: string;
}
