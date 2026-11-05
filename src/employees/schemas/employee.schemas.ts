import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { Role } from "src/enum/role.enum";

export type EmployeeDocument = HydratedDocument<Employee>;
@Schema({ timestamps: true })
export class Employee {
  @Prop()
  firstname: string;

  @Prop()
  lastname: string;

  @Prop()
  email: string;

  @Prop()
  password: string;

  @Prop({ required: false })
  phone: string;

  @Prop(
    {
      enum: Role,
      type: String,
      default: Role.EMPLOYEE
    }
  )
  role: Role;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;

}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);