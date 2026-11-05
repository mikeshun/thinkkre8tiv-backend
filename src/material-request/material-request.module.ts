import { Module } from '@nestjs/common';
import { MaterialRequestService } from './material-request.service';
import { MaterialRequestController } from './material-request.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MaterialRequest,
  MaterialRequestSchema,
} from './schemas/material-request.schemas';
import { InventoryModule } from 'src/inventory/inventory.module';
import { InvoiceSchema } from 'src/invoice/schemas/invoice.schemas';
import { EmployeesModule } from 'src/employees/employees.module';
import { AdminModule } from 'src/admin/admin.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaterialRequest.name, schema: MaterialRequestSchema },
      { name: 'Invoice', schema: InvoiceSchema },
    ]),
    InventoryModule,
    EmployeesModule,
    AdminModule,
  ],
  controllers: [MaterialRequestController],
  providers: [MaterialRequestService],
  exports: [
    MaterialRequestService,
    MongooseModule,
  ],
})
export class MaterialRequestModule { }
