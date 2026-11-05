import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { SearchInventoryDto } from './dto/search-inventory.dto';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from 'src/guard/role.guard';
import { Roles } from 'src/enum/roles.decorator';
import { Role } from 'src/enum/role.enum';

@ApiBearerAuth('access-token')
@Controller('api/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Post('')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  create(@Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.addInventory(createInventoryDto);
  }

  @Get('')
  findAll() {
    return this.inventoryService.getAllMaterial();
  }

  @Get('search')
  @ApiQuery({ name: 'q', required: false, description: 'General search term (name)' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'minQuantity', required: false, type: Number })
  @ApiQuery({ name: 'maxQuantity', required: false, type: Number })
  search(@Query() query: SearchInventoryDto) {
    return this.inventoryService.searchInventory(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.getOneMaterial(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  update(
    @Param('id') id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoryService.updateMaterial(id, updateInventoryDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  remove(@Param('id') id: string) {
    return this.inventoryService.removeMaterial(id);
  }
}
