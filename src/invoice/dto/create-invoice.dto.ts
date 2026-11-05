import { Type } from "class-transformer";
import { IsArray, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JobStatus, Status } from "src/enum/invoice.enum";



export class CreateInvoiceDto {

  @IsOptional()
  @IsMongoId()
  @ApiProperty({ required: false, default: '67a8d19138a1de11ad44f71a' })
  userId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, default: 'John' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, default: 'Doe' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, enum: ['admin', 'employee'], default: 'employee' })
  userType?: string;

  @IsOptional()
  @IsMongoId()
  @ApiProperty({ required: false, default: '67a8d19138a1de11ad44f71a' })
  materialRequestId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: true, default: 'Invoice for service provided for kwesi Oppong' })
  title: string;


  @IsOptional()
  @IsString()
  @ApiProperty({ required: true, default: 'kwesi Oppong' })
  clientName: string;


  @IsOptional()
  @IsString()
  @ApiProperty({ required: true, default: 'kwesioppong@gmail.com' })
  clientEmail: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: true, default: 'Accra-Amasaman' })
  clientAddress: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, default: '+233 20 000 0000' })
  clientPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @ApiProperty({
    required: true,
    default: [
      {
        inventoryItem: '67a6962d540ed4c9b358af77',
        quantity: 10,
        cost: 30
      },
      {
        inventoryItem: '67a696f8f9387b4eed9a6a88',
        quantity: 60,
        cost: 30
      }
    ]
  })
  items: InvoiceItemDto[];


}


class InvoiceItemDto {
  @IsMongoId()
  @ApiProperty({ required: true, default: '67a8d19138a1de11ad44f71a' })
  inventoryItem: string;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ required: true, default: 20 })
  quantity: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ required: true, default: 40 })
  cost: number;

}




export class StatusDto {

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ required: true, default: Status.PENDING })
  status: Status
}

export class JobStatusDto {
  @IsNotEmpty()
  @IsEnum(JobStatus)
  @ApiProperty({ required: true, enum: JobStatus, default: JobStatus.NOT_STARTED })
  jobStatus: JobStatus
}