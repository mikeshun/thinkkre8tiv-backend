import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { SearchInventoryDto } from './dto/search-inventory.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory } from './schemas/inventory.schemas';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  constructor(@InjectModel(Inventory.name) private readonly inventoryModel: Model<Inventory>) { }
  async addInventory(createInventoryDto: CreateInventoryDto) {
    try {

      const inventory = await this.inventoryModel.create(createInventoryDto)
      this.logger.log(`Inventory added:>>${inventory}`)
      return {
        message: 'Successfully added to inventory',
        material: inventory
      }


    } catch (error) {
      this.logger.log(error)
      throw new ConflictException(error.message || 'Something went wrong')

    }
  }

  async getAllMaterial() {
    try {
      const inventory = await this.inventoryModel.find().exec()
      console.log("Successfully retrieved all materials")
      return {
        message: "Successfully retrieved all materials",
        inventory: inventory
      };

    } catch (error) {
      this.logger.log(error)
      throw new ConflictException('Something went wrong!')

    }
  }

  async getOneMaterial(id: string) {
    try {
      const inventory = await this.inventoryModel.findById(id)

      if (!inventory) {
        throw new NotFoundException('material not found')
      }

      return {
        message: "Successfully retrieved material",
        inventory: inventory
      }

    } catch (error) {
      this.logger.error('error :>>', error)
      throw error

    }
  }

  async updateMaterial(id: string, updateInventoryDto: UpdateInventoryDto) {

    try {

      const inventory = await this.inventoryModel.findByIdAndUpdate(id, updateInventoryDto, { new: true })
      if (!inventory) {
        this.logger.log('inventory not found')
        throw new NotFoundException('Inventory not found')
      }

      console.log(`Successfully updated inventory ${id}`)

      return {
        message: "Successfully updated material details",
        inventory: inventory
      }

    } catch (error) {
      this.logger.log(error)
      throw error
    }
  }

  async removeMaterial(id: string) {
    try {
      const inventory = await this.inventoryModel.findByIdAndDelete(id)

      this.logger.log(`Removing ${inventory.name}`)
      return ('Material successfully deleted')

    } catch (error) {
      throw new ConflictException('Something went wrong')
    }
  }

  async searchInventory(searchDto: SearchInventoryDto) {
    try {
      const query: any = {};

      const searchTerm = searchDto.q || searchDto.name;
      if (searchTerm) {
        query.name = { $regex: searchTerm, $options: 'i' };
      }

      if (searchDto.minQuantity !== undefined || searchDto.maxQuantity !== undefined) {
        query.quantity = {};
        if (searchDto.minQuantity !== undefined) {
          query.quantity.$gte = searchDto.minQuantity;
        }
        if (searchDto.maxQuantity !== undefined) {
          query.quantity.$lte = searchDto.maxQuantity;
        }
      }

      const inventory = await this.inventoryModel.find(query).exec();

      return {
        success: true,
        message: `Found ${inventory.length} items matching criteria`,
        inventory,
      };
    } catch (error) {
      this.logger.error(`Error searching inventory: ${error.message}`);
      throw new ConflictException('Error performing inventory search');
    }
  }
}
