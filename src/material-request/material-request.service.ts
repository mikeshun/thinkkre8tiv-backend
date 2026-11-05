import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateMaterialRequestDto,
  StatusDto,
} from './dto/create-material-request.dto';
import { UpdateMaterialRequestDto } from './dto/update-material-request.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MaterialRequest } from './schemas/material-request.schemas';
import { Inventory } from 'src/inventory/schemas/inventory.schemas';
import { MaterialStatus } from 'src/enum/material-request.enum';

interface RequestUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class MaterialRequestService {
  private readonly logger = new Logger(MaterialRequestService.name);
  constructor(
    @InjectModel(MaterialRequest.name)
    private readonly materialRequestModel: Model<MaterialRequest>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<Inventory>,
    @InjectModel('Invoice') private readonly invoiceModel: Model<any>,
    @InjectModel('Employee') private readonly employeeModel: Model<any>,
    @InjectModel('Admin') private readonly adminModel: Model<any>,
  ) { }

  async requestMaterial(createMaterialRequestDto: CreateMaterialRequestDto, user?: RequestUser) {
    try {
      const inventoryItem = await this.inventoryModel.findById(
        createMaterialRequestDto.inventoryItem,
      );
      if (!inventoryItem) {
        throw new NotFoundException('Inventory Item not found');
      }

      if (inventoryItem.quantity < createMaterialRequestDto.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}, Requested: ${createMaterialRequestDto.quantity}`,
        );
      }

      const costPerItem = inventoryItem.cost;
      const totalCost = costPerItem * createMaterialRequestDto.quantity;

      const invoice = await this.invoiceModel.findById(createMaterialRequestDto.invoiceId);
      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${createMaterialRequestDto.invoiceId} not found`);
      }

      // Resolve requester name from DB using JWT email (avoids ObjectId conversion issues)
      let requestedBy: any = undefined;
      if (user?.email) {
        const isAdmin = user.role?.toUpperCase() === 'ADMIN';
        const person = (isAdmin
          ? await this.adminModel.findOne({ email: user.email }).select('_id firstname lastname email').lean()
          : await this.employeeModel.findOne({ email: user.email }).select('_id firstname lastname email').lean()) as any;

        if (person) {
          requestedBy = {
            userId: person._id,
            firstName: person.firstname,
            lastName: person.lastname,
            email: person.email,
            role: user.role,
          };
        }
      }

      const payload = {
        inventoryItem: createMaterialRequestDto.inventoryItem,
        invoice: createMaterialRequestDto.invoiceId,
        name: inventoryItem.name,
        quantity: createMaterialRequestDto.quantity,
        costPerItem: costPerItem,
        totalCost: totalCost,
        purpose: createMaterialRequestDto.purpose,
        status: MaterialStatus.PENDING,
        ...(requestedBy && { requestedBy }),
      };

      const materialRequest = await this.materialRequestModel.create(payload);

      // Link Invoice to Material Request
      await this.invoiceModel.findByIdAndUpdate(createMaterialRequestDto.invoiceId, {
        materialRequest: materialRequest._id
      });

      this.logger.log(`material requested :>> ${materialRequest}`);

      return {
        success: true,
        message: 'Successfully requested for a material and linked to invoice',
        material: materialRequest,
      };
    } catch (error) {
      this.logger.error('error :>>', error);
      throw error;
    }
  }

  async getAllMaterialRequested() {
    try {
      const material = await this.materialRequestModel
        .find()
        .populate('invoice', 'clientName invoiceId')
        .sort({ createdAt: -1 })
        .exec();
      this.logger.log('material requested', material);
      return {
        success: true,
        message: 'Successfully retrieved all material requested',
        data: material,
      };
    } catch (error) {
      this.logger.log(error.message);
      throw error;
    }
  }

  async getOneMaterialRequested(id: string) {
    try {
      const material = await this.materialRequestModel.findById(id).exec();
      if (!material) {
        this.logger.log('Material request not found');
        throw new NotFoundException('Material request item not found');
      }

      return {
        success: true,
        message: 'Successfully retrieved a material request item',
        data: material,
      };
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async update(id: string, updateMaterialRequestDto: UpdateMaterialRequestDto) {
    try {
      const materialRequest = await this.materialRequestModel
        .findById(id)
        .exec();
      if (!materialRequest) {
        throw new NotFoundException(`Material request with ID ${id} not found`);
      }

      let updateData: any = { ...updateMaterialRequestDto };

      if (updateMaterialRequestDto.quantity !== undefined) {
        if (materialRequest.inventoryDeducted) {
          throw new BadRequestException('Cannot change the quantity of an approved request; its stock has already been deducted');
        }
        const inventoryItem = await this.inventoryModel
          .findById(materialRequest.inventoryItem)
          .exec();
        if (!inventoryItem) {
          throw new NotFoundException('No associated inventory item found');
        }
        if (inventoryItem.quantity < updateMaterialRequestDto.quantity) {
          throw new BadRequestException(`Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}, Requested: ${updateMaterialRequestDto.quantity}`)

        }

        const costPerItem = inventoryItem.cost;
        const totalCost = updateMaterialRequestDto.quantity * costPerItem;


        updateData.costPerItem = costPerItem;
        updateData.totalCost = totalCost;
      }




      const updatedMaterialRequest = await this.materialRequestModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();

      this.logger.log(`Material request updated: ${updatedMaterialRequest}`);

      return {
        success: true,
        message: 'Material request updated successfully',
        data: updatedMaterialRequest,
      };
    } catch (error) {
      this.logger.error(`Error updating material request: ${error.message}`);
      throw error;
    }
  }

  async updateStatus(id: string, status: StatusDto) {
    try {
      const material = await this.materialRequestModel.findById(id);
      if (!material) {
        throw new NotFoundException(`Material with id ${id} not found`);
      }

      // Prevent re-approving an already approved material request
      if (
        material.status === MaterialStatus.APPROVED &&
        status.status === MaterialStatus.APPROVED
      ) {
        throw new BadRequestException(
          'This material request has already been approved.',
        );
      }

      if (
        material.status === MaterialStatus.CANCELLED &&
        status.status === MaterialStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'This material request has already been cancelled.',
        );
      }

      let updated;
      if (status.status === MaterialStatus.APPROVED) {
        updated = await this.approveAndDeductInventory(material);
      } else if (material.inventoryDeducted) {
        updated = await this.revertAndRestockInventory(material, status.status);
      } else {
        material.status = status.status;
        updated = await material.save();
      }

      this.logger.log(`Material request updated: ${JSON.stringify(updated)}`);

      return {
        success: true,
        message: `Successfully ${status.status} material request`,
        data: updated,
      };
    } catch (error) {
      this.logger.error(`Error updating status: ${error.message}`);
      throw error;
    }
  }

  // Claims the request first so two concurrent approvals can't both deduct,
  // then takes the stock only if enough is left; rolls the claim back otherwise.
  private async approveAndDeductInventory(material: any) {
    const previousStatus = material.status;
    const claimed = await this.materialRequestModel.findOneAndUpdate(
      { _id: material._id, status: { $ne: MaterialStatus.APPROVED }, inventoryDeducted: { $ne: true } },
      { status: MaterialStatus.APPROVED, inventoryDeducted: true },
      { new: true },
    );
    if (!claimed) {
      throw new BadRequestException('This material request has already been approved.');
    }

    const inventory = await this.inventoryModel.findOneAndUpdate(
      { _id: material.inventoryItem, quantity: { $gte: material.quantity } },
      { $inc: { quantity: -material.quantity } },
      { new: true },
    );
    if (!inventory) {
      await this.materialRequestModel.updateOne(
        { _id: material._id },
        { status: previousStatus, inventoryDeducted: false },
      );
      const current = await this.inventoryModel.findById(material.inventoryItem);
      if (!current) {
        throw new NotFoundException('Inventory item for this request no longer exists');
      }
      throw new BadRequestException(
        `Insufficient stock for ${current.name}. Available: ${current.quantity}, Requested: ${material.quantity}`,
      );
    }

    this.logger.log(`Deducted ${material.quantity} of ${inventory.name} (now ${inventory.quantity}) for request ${material._id}`);
    return claimed;
  }

  // An approved request moving to any other status hands its stock back
  private async revertAndRestockInventory(material: any, newStatus: MaterialStatus) {
    const released = await this.materialRequestModel.findOneAndUpdate(
      { _id: material._id, inventoryDeducted: true },
      { status: newStatus, inventoryDeducted: false },
      { new: true },
    );
    if (!released) {
      material.status = newStatus;
      return material.save();
    }

    await this.inventoryModel.updateOne(
      { _id: material.inventoryItem },
      { $inc: { quantity: material.quantity } },
    );
    this.logger.log(`Restocked ${material.quantity} of ${material.name} after request ${material._id} moved to ${newStatus}`);
    return released;
  }

  async remove(id: string) {
    try {
      const material = await this.materialRequestModel
        .findByIdAndDelete(id)
        .exec();
      if (!material) {
        throw new NotFoundException(`Id ${id} not found`);
      }
      return {
        success: true,
        message: `Successfully deleted request item`,
      };
    } catch (error) {
      this.logger.log(error);
      throw error;
    }
  }

  //   async Search(searchCriteria: any){
  //   try{

  //   }
  //   catch(error){
  //     this.logger.error(`Error searching for material request: ${error.message}`);
  //     throw error
  //   }
  // }

  async search(
    status?: string,
    name?: string,
    purpose?: string,
    requestStartDate?: string,
    requestEndDate?: string,
    approvalStartDate?: string,
    approvalEndDate?: string,
    q?: string,
  ) {
    try {
      const query: any = {};

      // Status filter
      if (status) {
        query.status = status;
      }

      if (name) {
        query.name = { $regex: name, $options: 'i' };
      }

      if (purpose) {
        query.purpose = { $regex: purpose, $options: 'i' };
      }

      if (q) {
        const matchingInvoices = await this.invoiceModel
          .find({ clientName: { $regex: q, $options: 'i' } })
          .select('_id')
          .lean();
        const invoiceIds = matchingInvoices.map((inv: any) => inv._id);
        this.logger.log(`[search] q="${q}" → matched ${matchingInvoices.length} invoice(s): ${JSON.stringify(invoiceIds)}`);

        query.$or = [
          { name: { $regex: q, $options: 'i' } },
          { purpose: { $regex: q, $options: 'i' } },
          ...(invoiceIds.length ? [{ invoice: { $in: invoiceIds } }] : []),
        ];
        this.logger.log(`[search] final query: ${JSON.stringify(query)}`);
      }

      // Request date filter (using createdAt)
      if (requestStartDate || requestEndDate) {
        query.createdAt = {};

        if (requestStartDate) {
          const start = new Date(requestStartDate);
          start.setHours(0, 0, 0, 0);
          query.createdAt.$gte = start;
        }

        if (requestEndDate) {
          const end = new Date(requestEndDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      // Approval date filter
      if (approvalStartDate || approvalEndDate) {
        query.updatedAt = {};
        query.status = MaterialStatus.APPROVED; // Only approved items have approval dates

        if (approvalStartDate) {
          const start = new Date(approvalStartDate);
          start.setHours(0, 0, 0, 0);
          query.updatedAt.$gte = start;
        }

        if (approvalEndDate) {
          const end = new Date(approvalEndDate);
          end.setHours(23, 59, 59, 999);
          query.updatedAt.$lte = end;
        }
      }

      const materials = await this.materialRequestModel
        .find(query)
        .populate('invoice', 'clientName invoiceId')
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(`Search results found: ${materials.length}`);

      return {
        success: true,
        message: 'Successfully retrieved material requests',
        data: materials,
      };
    } catch (error) {
      this.logger.error(`Error searching material requests: ${error.message}`);
      throw error;
    }
  }
}
