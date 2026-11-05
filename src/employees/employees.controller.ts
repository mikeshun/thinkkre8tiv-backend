import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from 'src/enum/role.enum';
import { Roles } from 'src/enum/roles.decorator';
import { AuthGuard } from 'src/guard/auth.guard';
import { RolesGuard } from 'src/guard/role.guard';
import {
  ChangePasswordDto,
  CreateEmployeeDto,
  LoginEmployeeDto,
} from './dto/create-employee.dto';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/enum/public.decorator';

@ApiBearerAuth('access-token')
@Controller('api')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) { }

  @Post('employee/register')
  registerEmployee(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.registerEmployee(createEmployeeDto);
  }
  @ApiTags('Auth')
  @Public()
  @Post('employee/login')
  loginEmployee(@Body() loginDto: LoginEmployeeDto) {
    return this.employeesService.loginEmployee(loginDto);
  }

  @Get('employee')
  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  getAllEmployee(@Request() req: any) {
    console.log('Authenticated User:', req.user);
    return this.employeesService.getAllEmployee();
  }

  @Post('employee/change-password')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.employeesService.changePassword(dto);
  }

  @Get('employee/search')
  @ApiQuery({ name: 'q', required: false, description: 'General search term (firstname, lastname, or email)' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'phone', required: false })
  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  search(@Query() query: SearchEmployeeDto) {
    return this.employeesService.searchEmployees(query);
  }

  @Get('employee/:id')
  getEmployeeProfile(@Param('id') id: string) {
    return this.employeesService.getEmployeeProfile(id);
  }

  @Patch('employee/:id')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.updateEmployee(id, updateEmployeeDto);
  }

  @Delete('employee/:id')
  removeEmployee(@Param('id') id: string) {
    return this.employeesService.removeEmployee(id);
  }
}
