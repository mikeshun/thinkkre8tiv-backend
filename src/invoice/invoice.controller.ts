import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseFloatPipe } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, JobStatusDto, StatusDto } from './dto/create-invoice.dto';
import { SearchInvoiceDto } from './dto/search-invoice.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Status } from 'src/enum/invoice.enum';
import { Role } from 'src/enum/role.enum';
import { Roles } from 'src/enum/roles.decorator';
import { RolesGuard } from 'src/guard/role.guard';
@ApiBearerAuth('access-token')
@Controller('api')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) { }

  @Post('invoice')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoiceService.createInvoice(createInvoiceDto);
  }

  @Get('invoice')
  findAll() {
    return this.invoiceService.getInvoices();
  }

  @Get('invoice/completed')
  findCompleted() {
    return this.invoiceService.getCompletedInvoices();
  }

  @Get('invoice/search')
  @ApiQuery({ name: 'q', required: false, description: 'General search term (ID, name, or title)' })
  @ApiQuery({ name: 'invoiceId', required: false })
  @ApiQuery({ name: 'clientName', required: false })
  @ApiQuery({ name: 'clientEmail', required: false })
  @ApiQuery({ name: 'title', required: false })
  @ApiQuery({ name: 'status', required: false, enum: Status })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  search(@Query() query: SearchInvoiceDto) {
    return this.invoiceService.searchInvoices(query);
  }

  @Get('invoice/stats')
  getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.invoiceService.getStats(startDate, endDate);
  }

  @Post('invoice/:id/payment')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  recordPayment(
    @Param('id') id: string,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.invoiceService.recordPayment(id, body.amount, body.note);
  }

  @Get('invoice/:id')
  findOne(@Param('id') id: string) {
    return this.invoiceService.getInvoiceById(id);
  }

  @Patch('invoice/status/:id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  updateStatus(@Param('id') id: string, @Body() statusDto: StatusDto) {
    return this.invoiceService.updateStatusInvoice(id, statusDto);
  }

  @Patch('invoice/job-status/:id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  updateJobStatus(@Param('id') id: string, @Body() dto: JobStatusDto) {
    return this.invoiceService.updateJobStatus(id, dto);
  }

  @Get('invoice/user/:id')
  getUserInvoices(@Param('id') id: string) {
    return this.invoiceService.getUserInvoices(id)
  }

  @Delete('invoice/:id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  remove(@Param('id') id: string) {
    return this.invoiceService.deleteInvoice(id);
  }
}
