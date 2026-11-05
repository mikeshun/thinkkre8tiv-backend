import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ChangePasswordDto,
  CreateEmployeeDto,
  LoginEmployeeDto,
} from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Employee } from './schemas/employee.schemas';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);
  constructor(
    @InjectModel(Employee.name) private readonly employeeModel: Model<Employee>,
    private readonly jwtService: JwtService,
  ) { }

  private generatePassword(): string {
    return crypto.randomBytes(6).toString('hex');
  }

  // 10 chars with at least one uppercase, lowercase, digit and symbol; look-alike characters excluded
  private generateEmployeePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*?';
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[crypto.randomInt(set.length)];

    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (chars.length < 10) chars.push(pick(all));

    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  async registerEmployee(createEmployeeDto: CreateEmployeeDto) {
    try {
      const existingEmployee = await this.employeeModel.findOne({
        email: createEmployeeDto.email,
      });
      if (existingEmployee) {
        throw new ConflictException('This Employee already exist');
      }

      if (createEmployeeDto.role == 'ADMIN') {
        throw new ConflictException('Admin role is not allowed for this user');
      }
      const generatedPassword = this.generateEmployeePassword();
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      const newEmployee = new this.employeeModel({
        ...createEmployeeDto,
        password: hashedPassword,
      });
      this.logger.log(newEmployee);
      await newEmployee.save();

      return {
        message: 'Employee successfully created',
        employee: {
          firstname: newEmployee.firstname,
          lastname: newEmployee.lastname,
          email: newEmployee.email,
          role: newEmployee.role,
        },
        // Plaintext is returned once so the admin can hand it over; only the hash is stored
        generatedPassword,
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async loginEmployee(loginDto: LoginEmployeeDto) {
    try {
      if (!loginDto.email || !loginDto.password) {
        throw new BadRequestException('Email and password are required');
      }

      const employee = await this.employeeModel
        .findOne({ email: loginDto.email })
        .exec();
      if (!employee) {
        throw new UnauthorizedException('Employee not found');
      }

      const isMatch = await bcrypt.compare(
        loginDto.password,
        employee.password,
      );
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        id: employee._id,
        email: employee.email,
        role: employee.role,
      };
      const accessToken = this.jwtService.sign(payload);
      const refreshToken = this.jwtService.sign(payload);

      this.logger.log(
        `Employee logged in: ${employee.firstname}. ${employee.email}`,
      );
      this.logger.log('Login successful', payload);
      return {
        success: true,
        message: 'Login Successful',
        employee: {
          employeeId: employee._id,
          firstname: employee.firstname,
          lastname: employee.lastname,
          email: employee.email,
          role: employee.role,
        },
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
    } catch (error) {
      this.logger.log(error.message);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new ConflictException(error.message || 'Something went wrong');
    }
  }

  async changePassword(changeDto: ChangePasswordDto) {
    try {
      const employee = await this.employeeModel
        .findOne({ email: changeDto.email })
        .exec();
      if (!employee) {
        throw new NotFoundException('User not found');
      }

      /*
      const isPasswordValid = await bcrypt.compare(
        changeDto.oldPassword,
        employee.password,
      );
      if (!isPasswordValid) {
        throw new BadRequestException('Invalid old password');
      }
        */
      const generatedPassword = this.generatePassword();
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      await this.employeeModel
        .updateOne(
          { email: changeDto.email },
          { $set: { password: hashedPassword } },
        )
        .exec();

      this.logger.log(`Password changed for ${employee.email}`)

      return {
        success: true,
        message: `Password changed successfully for ${employee.email}`,
        password: generatedPassword,
      }
    } catch (error) {
      this.logger.log(error);
    }
  }

  async getAllEmployee() {
    try {
      const employee = await this.employeeModel.find().sort({ createdAt: -1 });
      return {
        message: 'Successfully retrieved all employess',
        employees: employee,
      };
    } catch (error) {
      this.logger.log(error.message);
      throw new ConflictException('Something went wrong');
    }
  }

  async getEmployeeProfile(id: string) {
    try {
      const employee = await this.employeeModel.findById(id).exec();
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
      return {
        message: 'Successfully retrieved employee profile',
        employee: employee,
      };
    } catch (error) {
      this.logger.log(error.message);

      throw error;
    }
  }

  async updateEmployee(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    try {
      const employee = await this.employeeModel
        .findByIdAndUpdate(id, updateEmployeeDto, { new: true })
        .exec();
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
      return {
        message: 'Successfully updated employee profile',
        employee: employee,
      };
    } catch (error) {
      this.logger.log(error.message);
      throw error;
    }
  }

  async removeEmployee(id: string) {
    try {
      const inventory = await this.employeeModel.findByIdAndDelete(id);
      if (!inventory) {
        throw new NotFoundException('Employee not found');
      }

      this.logger.log('Successfully deleted employee');
      return {
        message: 'Successfully deleted employee',
      };
    } catch (error) {
      this.logger.log(error.message);

      if (error instanceof HttpException) {
        throw error;
      }
      throw new ConflictException('Something went wrong');
    }
  }

  async searchEmployees(searchDto: SearchEmployeeDto) {
    try {
      const query: any = {};

      const searchTerm = searchDto.q || searchDto.name;
      if (searchTerm) {
        query.$or = [
          { firstname: { $regex: searchTerm, $options: 'i' } },
          { lastname: { $regex: searchTerm, $options: 'i' } }
        ];
      }

      if (searchDto.email || (searchDto.q && !searchDto.name)) {
        const mailSearch = searchDto.email || searchDto.q;
        if (query.$or) {
          query.$or.push({ email: { $regex: mailSearch, $options: 'i' } });
        } else {
          query.email = { $regex: mailSearch, $options: 'i' };
        }
      }

      if (searchDto.role) {
        query.role = searchDto.role;
      }

      if (searchDto.phone) {
        query.phone = { $regex: searchDto.phone, $options: 'i' };
      }

      const employees = await this.employeeModel.find(query).sort({ createdAt: -1 }).exec();

      return {
        success: true,
        message: `Found ${employees.length} employees matching criteria`,
        employees,
      };
    } catch (error) {
      this.logger.error(`Error searching employees: ${error.message}`);
      throw new InternalServerErrorException('Error performing employee search');
    }
  }
}
