import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { MaterialRequestService } from './material-request.service';
import {
  CreateMaterialRequestDto,
  StatusDto,
} from './dto/create-material-request.dto';
import { UpdateMaterialRequestDto } from './dto/update-material-request.dto';
import { Public } from 'src/enum/public.decorator';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MaterialStatus } from 'src/enum/material-request.enum';
import { RolesGuard } from 'src/guard/role.guard';
import { Roles } from 'src/enum/roles.decorator';
import { Role } from 'src/enum/role.enum';

@ApiBearerAuth('access-token')
@Controller('api')
export class MaterialRequestController {
  constructor(
    private readonly materialRequestService: MaterialRequestService,
  ) { }

  @Post('material-request')
  create(@Body() createMaterialRequestDto: CreateMaterialRequestDto, @Req() req: Request) {
    return this.materialRequestService.requestMaterial(
      createMaterialRequestDto,
      req.user as any,
    );
  }


  @Get('material-request')
  findAll() {
    return this.materialRequestService.getAllMaterialRequested();
  }

  @Get('material-request/search')
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'General search term (item name or purpose)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: MaterialStatus,
    description: 'Filter by material request status',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Search by item name',
  })
  @ApiQuery({
    name: 'purpose',
    required: false,
    type: String,
    description: 'Search by purpose',
  })
  @ApiQuery({
    name: 'requestStartDate',
    required: false,
    type: String,
    description: 'Request start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'requestEndDate',
    required: false,
    type: String,
    description: 'Request end date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'approvalStartDate',
    required: false,
    type: String,
    description: 'Approval start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'approvalEndDate',
    required: false,
    type: String,
    description: 'Approval end date (YYYY-MM-DD)',
  })
  async search(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('name') name?: string,
    @Query('purpose') purpose?: string,
    @Query('requestStartDate') requestStartDate?: string,
    @Query('requestEndDate') requestEndDate?: string,
    @Query('approvalStartDate') approvalStartDate?: string,
    @Query('approvalEndDate') approvalEndDate?: string,
  ) {
    return this.materialRequestService.search(
      status,
      name,
      purpose,
      requestStartDate,
      requestEndDate,
      approvalStartDate,
      approvalEndDate,
      q,
    );
  }

  @Get('material-request/:id')
  findOne(@Param('id') id: string) {
    return this.materialRequestService.getOneMaterialRequested(id);
  }

  @Patch('material-request/:id')
  update(
    @Param('id') id: string,
    @Body() updateMaterialRequestDto: UpdateMaterialRequestDto,
  ) {
    return this.materialRequestService.update(id, updateMaterialRequestDto);
  }
  @Patch('material-request/status/:id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  updateStatus(@Param('id') id: string, @Body() status: StatusDto) {
    return this.materialRequestService.updateStatus(id, status);
  }

  @Delete('material-request/:id')
  remove(@Param('id') id: string) {
    return this.materialRequestService.remove(id);
  }
}
