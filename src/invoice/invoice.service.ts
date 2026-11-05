import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice } from './schemas/invoice.schemas';
import { Admin } from '../admin/schemas/admin.schemas';
import { Employee } from '../employees/schemas/employee.schemas';
import { Inventory } from '../inventory/schemas/inventory.schemas';
import { CreateInvoiceDto, JobStatusDto, StatusDto } from './dto/create-invoice.dto';
import { JobStatus, Status } from '../enum/invoice.enum';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { SearchInvoiceDto } from './dto/search-invoice.dto';

// An invoice is closed once it is fully paid and the job is done
const CLOSED_INVOICE_FILTER = { status: Status.PAID, jobStatus: JobStatus.COMPLETED };
const ACTIVE_INVOICE_FILTER = { $nor: [CLOSED_INVOICE_FILTER] };

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<Employee>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<Inventory>,
    @InjectModel('MaterialRequest') private readonly materialRequestModel: Model<any>
  ) { }

  private async formatInvoiceResponse(invoice: any, includeUserInfo = true) {
    // Ensure we are working with a plain object if it's a Mongoose document
    const invoiceData = invoice.toObject ? invoice.toObject() : invoice;
    const items = invoiceData.items || [];

    const formattedItems = await Promise.all(items.map(async (item: any) => {
      const inventory = await this.inventoryModel.findById(item.inventoryItem);
      return {
        _id: item.inventoryItem.toString(),
        name: item.name,
        quantity: item.quantity,
        cost: item.costPerItem,
        totalCost: item.cost,
        available: inventory?.quantity || 0
      };
    }));

    let userInfo = {};

    if (includeUserInfo) {
      const userAcc = invoiceData.userAccount;
      if (userAcc) {
        userInfo = {
          name: `${userAcc.firstName || ''} ${userAcc.lastName || ''}`.trim() || 'Unknown User',
          userType: userAcc.userType
        };

        // Attempt to fetch more details if we have an ID
        const userId = userAcc.adminId || userAcc.employeeId;
        if (userId) {
          const user = await (userAcc.userType === 'admin'
            ? this.adminModel.findById(userId)
            : this.employeeModel.findById(userId));

          if (user) {
            userInfo = {
              ...userInfo,
              email: user.email,
              role: user.role
            };
          }
        }
      }
    }

    const payments = invoiceData.payments || [];
    const amountPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const balance = Math.max(0, invoiceData.totalCost - amountPaid);

    return {
      success: true,
      message: 'Invoice retrieved successfully',
      invoice: {
        _id: invoiceData._id.toString(),
        invoiceId: invoiceData.invoiceId,
        title: invoiceData.title,
        clientName: invoiceData.clientName,
        clientEmail: invoiceData.clientEmail,
        clientAddress: invoiceData.clientAddress,
        userInfo,
        items: formattedItems,
        totalQuantity: invoiceData.totalQuantity,
        totalCost: invoiceData.totalCost,
        amountPayable: invoiceData.totalCost,
        payments,
        amountPaid,
        balance,
        status: invoiceData.status,
        jobStatus: invoiceData.jobStatus || JobStatus.NOT_STARTED,
        createdAt: invoiceData.createdAt,
        updatedAt: invoiceData.updatedAt
      }
    };
  }

  async createInvoice(createInvoiceDto: CreateInvoiceDto) {
    try {

      let user = createInvoiceDto.userId ? await this.adminModel.findById(createInvoiceDto.userId) : null;
      let userType = createInvoiceDto.userType || 'admin';

      if (!user && createInvoiceDto.userId) {
        user = await this.employeeModel.findById(createInvoiceDto.userId);
        userType = 'employee';
      }

      // If user still not found but userId was provided, we just log it and proceed with provided names
      if (!user && createInvoiceDto.userId) {
        this.logger.warn(`User with ID ${createInvoiceDto.userId} not found, proceeding with provided details`);
      }

      if (createInvoiceDto.materialRequestId) {
        const materialRequest = await this.materialRequestModel.findById(createInvoiceDto.materialRequestId);
        if (!materialRequest) {
          throw new NotFoundException('Material request not found');
        }
      }



      // Process items
      const processedItems = [];
      let totalQuantity = 0;
      let totalCost = 0;

      for (const item of createInvoiceDto.items) {
        const inventory = await this.inventoryModel.findById(item.inventoryItem);
        if (!inventory) {
          throw new NotFoundException(`Inventory item ${item.inventoryItem} not found`);
        }

        if (inventory.quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${inventory.name}. Available: ${inventory.quantity}, Requested: ${item.quantity}`
          );
        }


        const itemTotalCost = (item.cost ?? inventory.cost) * item.quantity;

        processedItems.push({
          inventoryItem: new Types.ObjectId(item.inventoryItem),
          name: inventory.name,
          purchaseCost: inventory.cost,
          costPerItem: item.cost ?? inventory.cost,
          quantity: item.quantity,
          cost: itemTotalCost
        });

        totalQuantity += item.quantity;
        totalCost += itemTotalCost;


      }

      // Create invoice
      const invoice = await this.invoiceModel.create({
        title: createInvoiceDto.title,
        clientName: createInvoiceDto.clientName,
        clientEmail: createInvoiceDto.clientEmail,
        clientAddress: createInvoiceDto.clientAddress,
        items: processedItems,
        totalQuantity,
        totalCost,
        materialRequest: createInvoiceDto.materialRequestId,
        userAccount: {
          userType,
          [`${userType}Id`]: user?._id || createInvoiceDto.userId,
          firstName: createInvoiceDto.firstName || user?.firstname || 'Unknown',
          lastName: createInvoiceDto.lastName || user?.lastname || 'User'
        }
      });
      if (createInvoiceDto.materialRequestId) {
        await this.materialRequestModel.findByIdAndUpdate(createInvoiceDto.materialRequestId, {
          invoice: invoice._id
        });
      }

      this.logger.log('Successfully created invoice', invoice)

      return this.formatInvoiceResponse(invoice);
    } catch (error) {
      this.logger.error('Error creating invoice:', error);
      throw error;
    }
  }

  async getInvoices() {
    try {
      const invoices = await this.invoiceModel.find(ACTIVE_INVOICE_FILTER).sort({ createdAt: -1 });
      const formattedInvoices = await Promise.all(
        invoices.map(invoice => this.formatInvoiceResponse(invoice))
      );

      return {
        success: true,
        message: 'Invoices retrieved successfully',
        invoice: formattedInvoices.map(response => response.invoice)
      };

    }
    catch (error) {
      this.logger.log(error.message)
      throw error
    }

  }

  async getCompletedInvoices() {
    try {
      const invoices = await this.invoiceModel.find(CLOSED_INVOICE_FILTER).sort({ updatedAt: -1 });
      const formattedInvoices = await Promise.all(
        invoices.map(invoice => this.formatInvoiceResponse(invoice))
      );

      return {
        success: true,
        message: 'Completed invoices retrieved successfully',
        invoice: formattedInvoices.map(response => response.invoice)
      };
    } catch (error) {
      this.logger.log(error.message)
      throw error
    }
  }

  async getInvoiceById(id: string) {
    try {
      const invoice = await this.invoiceModel.findById(id);
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      return this.formatInvoiceResponse(invoice);
    } catch (error) {
      this.logger.error('Error retrieving invoice:', error);
      throw error;
    }
  }


  async updateInvoice(id: string, updateInvoiceDto: UpdateInvoiceDto) {
    try {
      const invoice = await this.invoiceModel.findByIdAndUpdate(id, updateInvoiceDto, { new: true })
      if (!invoice) {
        throw new NotFoundException('Invoice not found')
      }
      this.logger.log(`Successfully updated invoice with id ${invoice}`)
      return {
        success: true,
        message: "Successfully updated invoice",
        invoice: invoice
      }

    }
    catch (error) {
      this.logger.log(error);
      throw error
    }
  }
  async updateStatusInvoice(id: string, statusDto: StatusDto) {
    try {
      // Validate ID
      if (!id) {
        throw new BadRequestException('Invoice ID is required');
      }

      // Validate status against enum
      if (!Object.values(Status).includes(statusDto.status)) {
        this.logger.error(`Invalid status provided: ${statusDto.status}`);
        throw new BadRequestException(
          `Invalid status. Must be one of: ${Object.values(Status).join(', ')}`
        );
      }

      const invoice = await this.invoiceModel.findByIdAndUpdate(
        id,
        { status: statusDto.status },
        { new: true }
      ).exec();

      if (!invoice) {
        this.logger.error(`Invoice not found with id: ${id}`);
        throw new NotFoundException('Invoice not found');
      }

      this.logger.log(`Invoice ${id} status updated ${statusDto.status}`);

      // Handle inventory reduction when status is PAID
      if (statusDto.status === Status.PAID) {
        // Check if there's an associated material request
        // Find by invoice ID in material request schema since we link them
        const materialRequest = await this.materialRequestModel.findOne({ invoice: invoice._id });

        // Stock is now deducted when the request is approved (inventoryDeducted);
        // this path only covers requests approved before that change
        if (materialRequest && materialRequest.status === 'APPROVED' && !materialRequest.inventoryDeducted) {
          this.logger.log(`Reducing inventory for associated material request ${materialRequest._id}`);

          for (const item of invoice.items) {
            const inventoryItem = await this.inventoryModel.findById(item.inventoryItem);
            if (inventoryItem) {
              if (inventoryItem.quantity < item.quantity) {
                // We might want to just log this instead of throwing if the invoice is already marked as PAID
                this.logger.warn(`Insufficient stock for ${inventoryItem.name} during payment. Available: ${inventoryItem.quantity}, Needed: ${item.quantity}`);
              }
              inventoryItem.quantity -= item.quantity;
              await inventoryItem.save();
            }
          }
        } else if (materialRequest) {
          this.logger.warn(`Invoice ${id} set to PAID but associated material request is ${materialRequest.status}. Inventory NOT reduced.`);
        }
      }

      return this.formatInvoiceResponse(invoice);
    } catch (error) {
      this.logger.error(`Failed to update invoice status: ${error.message}`);
      throw error;
    }
  }
  async getUserInvoices(userId: string) {
    try {
      const invoices = await this.invoiceModel.find({
        ...ACTIVE_INVOICE_FILTER,
        $or: [
          { 'userAccount.adminId': userId },
          { 'userAccount.employeeId': userId }
        ]
      }).sort({ createdAt: -1 });

      const formattedInvoices = await Promise.all(
        invoices.map(invoice => this.formatInvoiceResponse(invoice))
      );

      return {
        success: true,
        message: 'User invoices retrieved successfully',
        invoice: formattedInvoices.map(response => response.invoice)
      };
    } catch (error) {
      this.logger.error('Error retrieving user invoices:', error);
      throw error;
    }
  }

  async deleteInvoice(id: string) {
    try {
      const invoice = await this.invoiceModel.findByIdAndDelete(id);
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      return {
        success: true,
        message: 'Invoice deleted successfully'
      };
    } catch (error) {
      this.logger.error('Error deleting invoice:', error);
      throw error;
    }
  }

  async searchInvoices(searchDto: SearchInvoiceDto) {
    try {
      const query: any = {};

      if (searchDto.q) {
        query.$or = [
          { invoiceId: { $regex: searchDto.q, $options: 'i' } },
          { clientName: { $regex: searchDto.q, $options: 'i' } },
          { title: { $regex: searchDto.q, $options: 'i' } }
        ];
      }

      if (searchDto.invoiceId) {
        query.invoiceId = { $regex: searchDto.invoiceId, $options: 'i' };
      }

      if (searchDto.clientName) {
        query.clientName = { $regex: searchDto.clientName, $options: 'i' };
      }

      if (searchDto.clientEmail) {
        query.clientEmail = { $regex: searchDto.clientEmail, $options: 'i' };
      }

      if (searchDto.title) {
        query.title = { $regex: searchDto.title, $options: 'i' };
      }

      if (searchDto.status) {
        query.status = searchDto.status;
      }

      if (searchDto.startDate || searchDto.endDate) {
        query.createdAt = {};
        if (searchDto.startDate) {
          const start = new Date(searchDto.startDate);
          start.setHours(0, 0, 0, 0);
          query.createdAt.$gte = start;
        }
        if (searchDto.endDate) {
          const end = new Date(searchDto.endDate);
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      const invoices = await this.invoiceModel.find(query).sort({ createdAt: -1 }).exec();

      const formattedInvoices = await Promise.all(
        invoices.map(invoice => this.formatInvoiceResponse(invoice))
      );

      return {
        success: true,
        message: `Found ${invoices.length} invoices matching criteria`,
        invoice: formattedInvoices.map(response => response.invoice)
      };
    } catch (error) {
      this.logger.error(`Error searching invoices: ${error.message}`);
      throw new BadRequestException('Error performing invoice search');
    }
  }

  async recordPayment(id: string, amount: number, note?: string) {
    try {
      const invoice = await this.invoiceModel.findById(id);
      if (!invoice) throw new NotFoundException('Invoice not found');

      invoice.payments = invoice.payments ?? [];
      invoice.payments.push({ amount, date: new Date(), note: note || '' });

      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid >= invoice.totalCost) {
        invoice.status = Status.PAID;
      }

      await invoice.save();
      return this.formatInvoiceResponse(invoice);
    } catch (error) {
      this.logger.error('Error recording payment:', error);
      throw error;
    }
  }

  async updateJobStatus(id: string, dto: JobStatusDto) {
    const invoice = await this.invoiceModel.findByIdAndUpdate(
      id,
      { jobStatus: dto.jobStatus },
      { new: true }
    );
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.formatInvoiceResponse(invoice);
  }

  async getStats(startDate?: string, endDate?: string) {
    try {
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const matchFilter: any = { status: Status.PAID };
      if (startDate || endDate) matchFilter.createdAt = dateFilter;

      const [invoiceTotals, itemTotals] = await Promise.all([
        this.invoiceModel.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalCost' },
              totalNegotiated: { $sum: '$totalCost' },
              paidCount: { $sum: 1 },
            },
          },
        ]),
        this.invoiceModel.aggregate([
          { $match: matchFilter },
          { $unwind: '$items' },
          {
            $group: {
              _id: null,
              totalPurchaseCost: {
                $sum: {
                  $multiply: [
                    { $ifNull: ['$items.purchaseCost', 0] },
                    '$items.quantity',
                  ],
                },
              },
            },
          },
        ]),
      ]);

      const totalRevenue = invoiceTotals[0]?.totalRevenue || 0;
      const totalNegotiated = invoiceTotals[0]?.totalNegotiated || 0;
      const paidCount = invoiceTotals[0]?.paidCount || 0;
      const totalPurchaseCost = itemTotals[0]?.totalPurchaseCost || 0;
      const totalProfit = totalNegotiated - totalPurchaseCost;

      return {
        success: true,
        data: {
          totalRevenue,
          totalProfit,
          totalPurchaseCost,
          paidCount,
        },
      };
    } catch (error) {
      this.logger.error(`Error calculating stats: ${error.message}`);
      throw error;
    }
  }
}