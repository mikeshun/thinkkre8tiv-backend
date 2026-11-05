import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types, } from "mongoose";
import { Admin } from "../../admin/schemas/admin.schemas";
import { Employee } from "../../employees/schemas/employee.schemas";
import { JobStatus, Status } from "../../enum/invoice.enum";
import { Inventory } from "../../inventory/schemas/inventory.schemas";

export type InvoiceItemDocument = HydratedDocument<InvoiceItem>;
export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ timestamps: true })
export class InvoiceItem {

  @Prop({ type: Types.ObjectId, ref: 'Inventory', required: true })
  inventoryItem: Types.ObjectId;

  // @Prop({ type: Types.ObjectId, ref: 'MaterialRequest', required: true }) 
  // materialRequest: Types.ObjectId;

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  costPerItem: number


  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  cost: number
}


export const InvoiceItemSchema = SchemaFactory.createForClass(InvoiceItem)

interface InventoryDocument extends Inventory, Document {
  name: string;
  cost: number;
}
InvoiceItemSchema.pre('save', async function (next) {
  if (this.isNew) {
    const inventory = await this.model('Inventory').findById(this.inventoryItem) as InventoryDocument
    if (inventory) {
      this.name = inventory.name;
      this.costPerItem = inventory.cost
    }
  }

  next();


})


interface StoredInvoiceItem {
  inventoryItem: Types.ObjectId;
  name: string;
  purchaseCost: number;
  costPerItem: number;
  quantity: number;
  cost: number;
}

interface StoredAdmin extends Admin, Document {
  userType: 'admin';
  adminId?: Types.ObjectId;
  firstName?: string;
  lastName?: string;
}

interface StoredEmployee extends Employee, Document {
  userType: 'employee';
  employeeId?: Types.ObjectId;
  firstName?: string;
  lastName?: string;
}


type UserAccount = StoredAdmin | StoredEmployee;


@Schema({ timestamps: true })
export class Invoice {
  @Prop({
    required: true,
    unique: true,
    default: () => `HRM${Math.floor(10000000 + Math.random() * 90000000)}`,
  })
  invoiceId: string;
  @Prop({
    type: [{
      _id: false,
      inventoryItem: { type: Types.ObjectId, required: true, ref: 'Inventory' },
      name: { type: String },
      purchaseCost: { type: Number },
      costPerItem: { type: Number },
      quantity: { type: Number },
      cost: { type: Number }
    }]
  })
  items: StoredInvoiceItem[];


  @Prop()
  title: string

  @Prop()
  clientName: string

  @Prop()
  clientEmail: string

  @Prop()
  clientAddress: string

  @Prop()
  clientPhone: string

  @Prop()
  totalCost: number

  @Prop()
  totalQuantity: number

  @Prop({
    enum: Status,
    type: String,
    default: Status.PENDING
  })
  status: Status

  @Prop({
    enum: JobStatus,
    type: String,
    default: JobStatus.NOT_STARTED,
  })
  jobStatus: JobStatus


  @Prop({
    type: {
      _id: false,
      userType: { type: String, enum: ['admin', 'employee'], required: false, default: 'employee' },
      adminId: { type: Types.ObjectId, ref: 'Admin', required: false },
      employeeId: { type: Types.ObjectId, ref: 'Employee', required: false },
      firstName: { type: String, required: false },
      lastName: { type: String, required: false }
    },
    required: false
  })
  userAccount: UserAccount;

  @Prop({ type: Types.ObjectId, ref: 'MaterialRequest' })
  materialRequest: Types.ObjectId;

  @Prop({
    type: [{
      _id: false,
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      note: { type: String, default: '' },
    }],
    default: [],
  })
  payments: { amount: number; date: Date; note: string }[];
}




export const InvoiceSchema = SchemaFactory.createForClass(Invoice)

//InvoiceSchema.index({ invoiceId: 1 }, { unique: true });
function generateUniqueInvoiceId(): string {
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000); // Generates 8 random digits
  return `HRM${randomDigits}`;
}

InvoiceSchema.pre('save', async function (next) {
  if (this.isNew) {






    // Calculate totals
    // this.totalQuantity = this.items.reduce((sum, item) => sum + item.quantity, 0);
    // this.totalCost = this.items.reduce((sum, item) => sum + item.cost, 0);

    // Populate user account details
    if (this.userAccount.userType === 'admin' && this.userAccount.adminId && !this.userAccount.firstName) {
      const admin = await this.model('Admin').findById(this.userAccount.adminId) as StoredAdmin
      if (admin) {
        this.userAccount.firstName = admin.firstname;
        this.userAccount.lastName = admin.lastname;
      }
    } else if (this.userAccount.userType === 'employee' && this.userAccount.employeeId && !this.userAccount.firstName) {
      const employee = await this.model('Employee').findById(this.userAccount.employeeId) as StoredEmployee
      if (employee) {
        this.userAccount.firstName = employee.firstname;
        this.userAccount.lastName = employee.lastname;
      }
    }
  }
  next();
});
