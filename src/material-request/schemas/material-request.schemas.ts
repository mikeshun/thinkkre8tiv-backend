import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { MaterialStatus } from "src/enum/material-request.enum";
import { Inventory, InventoryDocument } from "src/inventory/schemas/inventory.schemas";

export type MaterialRequestDocument = HydratedDocument<MaterialRequest>;

@Schema({ timestamps: true })
export class MaterialRequest {
  @Prop({ type: Types.ObjectId, ref: 'Inventory', required: true })
  inventoryItem: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Invoice' })
  invoice: Types.ObjectId;

  @Prop({
    type: {
      _id: false,
      userId: { type: Types.ObjectId, required: false },
      firstName: { type: String, required: false },
      lastName: { type: String, required: false },
      email: { type: String, required: false },
      role: { type: String, required: false },
    },
    required: false,
  })
  requestedBy: {
    userId: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };


  @Prop({ required: true })  
  name: string;

  @Prop({ required: true })
  quantity: number;

 
  @Prop({required: true})
  costPerItem: number

  @Prop({required:true})
  totalCost:number

  @Prop({ required: false })
  purpose: string;

  @Prop({
    enum: MaterialStatus,
    type: String,
    default: MaterialStatus.PENDING
  })
  status: MaterialStatus;

  // True while this request's quantity is held out of inventory (set on approval)
  @Prop({ type: Boolean, default: false })
  inventoryDeducted: boolean;

  @Prop({type:Date})
  createdAt?: Date;

  @Prop({type:Date})
  updatedAt?: Date;




}

export const MaterialRequestSchema = SchemaFactory.createForClass(MaterialRequest);


MaterialRequestSchema.pre('save', async function (next) {
  if (this.isNew) {
    const inventory = await this.model('Inventory').findById(this.inventoryItem) as InventoryDocument;
    if (inventory) {
      this.name = inventory.name;
      this.costPerItem = inventory.cost

    }
  }
  next();
});
