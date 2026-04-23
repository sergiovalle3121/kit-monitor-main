import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryPosition } from './entities/inventory-position.entity';
import { InventoryMovement, InventoryTransactionType } from './entities/inventory-movement.entity';
import { MaterialMaster } from './entities/material-master.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    @InjectRepository(MaterialMaster)
    private readonly materialRepo: Repository<MaterialMaster>,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllPositions(filters: { warehouseId?: string; partNumber?: string; programId?: string }): Promise<InventoryPosition[]> {
    const qb = this.positionRepo.createQueryBuilder('pos')
      .leftJoinAndSelect('pos.material', 'material')
      .leftJoinAndSelect('pos.warehouse', 'warehouse');

    if (filters.warehouseId) qb.andWhere('pos.warehouseId = :wh', { wh: filters.warehouseId });
    if (filters.partNumber) qb.andWhere('pos.partNumber LIKE :pn', { pn: `%${filters.partNumber}%` });
    if (filters.programId) qb.andWhere('pos.programId = :prog', { prog: filters.programId });

    return qb.getMany();
  }

  async getMovements(filters: { partNumber?: string; warehouseId?: string }): Promise<InventoryMovement[]> {
    const qb = this.movementRepo.createQueryBuilder('mov');
    if (filters.partNumber) qb.andWhere('mov.partNumber = :pn', { pn: filters.partNumber });
    if (filters.warehouseId) {
      qb.andWhere('(mov.fromWarehouseId = :wh OR mov.toWarehouseId = :wh)', { wh: filters.warehouseId });
    }
    qb.orderBy('mov.createdAt', 'DESC').limit(100);
    return qb.getMany();
  }

  /**
   * Primary transactional method for moving material.
   */
  async recordTransaction(dto: {
    type: InventoryTransactionType;
    partNumber: string;
    quantity: number;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    fromLocation?: string;
    toLocation?: string;
    programId?: string;
    actorName: string;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
  }): Promise<InventoryMovement> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate Material
      const material = await this.materialRepo.findOne({ where: { partNumber: dto.partNumber } });
      if (!material) throw new NotFoundException(`Material ${dto.partNumber} not found in Master Data`);

      // 2. Handle Source (subtract)
      if (dto.fromWarehouseId) {
        let sourcePos = await queryRunner.manager.findOne(InventoryPosition, {
          where: { 
            partNumber: dto.partNumber, 
            warehouseId: dto.fromWarehouseId, 
            location: dto.fromLocation || 'BULK',
            programId: dto.programId
          }
        });

        if (!sourcePos || sourcePos.onHand < dto.quantity) {
          throw new BadRequestException(`Insufficient stock in ${dto.fromWarehouseId} for ${dto.partNumber}`);
        }

        if (sourcePos.holdStatus !== 'available') {
          throw new BadRequestException(`Material ${dto.partNumber} is currently in status '${sourcePos.holdStatus}' and cannot be moved.`);
        }

        sourcePos.onHand -= dto.quantity;
        await queryRunner.manager.save(sourcePos);
      }

      // 3. Handle Destination (add)
      if (dto.toWarehouseId) {
        let destPos = await queryRunner.manager.findOne(InventoryPosition, {
          where: { 
            partNumber: dto.partNumber, 
            warehouseId: dto.toWarehouseId, 
            location: dto.toLocation || 'BULK',
            programId: dto.programId
          }
        });

        if (!destPos) {
          destPos = queryRunner.manager.create(InventoryPosition, {
            partNumber: dto.partNumber,
            warehouseId: dto.toWarehouseId,
            location: dto.toLocation || 'BULK',
            programId: dto.programId,
            onHand: 0
          });
        }

        destPos.onHand += dto.quantity;
        await queryRunner.manager.save(destPos);
      }

      // 4. Log Movement
      const movement = queryRunner.manager.create(InventoryMovement, {
        ...dto,
        createdAt: new Date()
      });
      const savedMovement = await queryRunner.manager.save(movement);

      await queryRunner.commitTransaction();
      return savedMovement;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Helper to ensure material exists in master data (used for auto-receiving/demos)
  async ensureMaterial(dto: Partial<MaterialMaster>): Promise<MaterialMaster> {
    if (!dto.partNumber) throw new BadRequestException('partNumber required');
    let m = await this.materialRepo.findOne({ where: { partNumber: dto.partNumber } });
    if (!m) {
      m = this.materialRepo.create({
        partNumber: dto.partNumber,
        description: dto.description || `Part ${dto.partNumber}`,
        uom: dto.uom || 'EA'
      });
      return this.materialRepo.save(m);
    }
    return m;
  }
}
