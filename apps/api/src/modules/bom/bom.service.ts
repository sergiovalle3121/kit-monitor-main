import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { BomItem } from './entities/bom-item.entity';
import { BomHeader, BomStatus } from './entities/bom-header.entity';
import { BomComponent } from './entities/bom-component.entity';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { CreateBomHeaderDto, CreateBomComponentDto } from './dto/create-bom.dto';
import { UpdateBomHeaderDto, UpdateBomComponentDto } from './dto/update-bom.dto';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { parseBomXlsx } from './bom-parser';
import { parseKanbanXlsx } from './kanban-parser';

const UPSERT_CHUNK = 500;

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(BomItem)
    private readonly repo: Repository<BomItem>,
    @InjectRepository(BomHeader)
    private readonly headerRepo: Repository<BomHeader>,
    @InjectRepository(BomComponent)
    private readonly componentRepo: Repository<BomComponent>,
    @InjectRepository(MaterialMaster)
    private readonly materialRepo: Repository<MaterialMaster>,
    @InjectRepository(EnterpriseProgram) private readonly programRepo: Repository<EnterpriseProgram>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(model?: string, programId?: string): Promise<BomItem[]> {
    if (model) return this.repo.findBy({ model });
    if (programId) {
      const program = await this.programRepo.findOne({ where: { id: programId } });
      const prefix = program?.primaryModelPrefix?.toUpperCase();
      if (prefix) {
        const all = await this.repo.find({ order: { model: 'ASC', partNumber: 'ASC' } });
        return all.filter((item) => item.model?.toUpperCase().startsWith(prefix));
      }
    }
    return this.repo.find({ order: { model: 'ASC', partNumber: 'ASC' } });
  }

  // ==================== BOM HEADER & COMPONENTS (SAP-style BOM Management) ====================

  async findAllBomHeaders(model?: string, status?: BomStatus): Promise<BomHeader[]> {
    const where: any = {};
    if (model) where.model = model;
    if (status) where.status = status;
    return this.headerRepo.find({ 
      where, 
      relations: ['components'],
      order: { createdAt: 'DESC' } 
    });
  }

  async findBomHeaderById(id: number): Promise<BomHeader> {
    const header = await this.headerRepo.findOne({ 
      where: { id }, 
      relations: ['components'] 
    });
    if (!header) throw new NotFoundException(`BOM Header ${id} not found`);
    return header;
  }

  async createBomWithComponents(dto: CreateBomHeaderDto): Promise<BomHeader> {
    // Check if model exists in MaterialMaster as a finished product
    const materialExists = await this.materialRepo.findOne({ where: { partNumber: dto.model } });
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const header = queryRunner.manager.create(BomHeader, {
        model: dto.model,
        productName: dto.productName || '',
        revision: dto.revision || '1.0',
        status: dto.status || BomStatus.DRAFT,
        bomType: dto.bomType || 'Manufacturing',
        baseQuantity: dto.baseQuantity || 1,
        baseUnit: dto.baseUnit || 'EA',
        description: dto.description || '',
        createdBy: dto.createdBy || 'System',
        estimatedCost: 0,
      });

      const savedHeader = await queryRunner.manager.save(header);

      // Add components if provided
      if (dto.components && dto.components.length > 0) {
        for (const compDto of dto.components) {
          // Validate component exists in MaterialMaster (inventory)
          const material = await this.materialRepo.findOne({ 
            where: { partNumber: compDto.componentNumber } 
          });

          if (!material) {
            throw new BadRequestException(
              `Component ${compDto.componentNumber} does not exist in Material Master. Please add it to inventory first.`
            );
          }

          const extendedCost = compDto.quantity * (compDto.usageFactor || 1) * (material.standardCost || 0);

          const component = queryRunner.manager.create(BomComponent, {
            bomHeaderId: savedHeader.id,
            level: compDto.level || 1,
            componentNumber: compDto.componentNumber,
            description: compDto.description || material.description,
            quantity: compDto.quantity,
            unit: compDto.unit || material.uom || 'EA',
            usageFactor: compDto.usageFactor || 1,
            referenceDesignator: compDto.referenceDesignator || '',
            notes: compDto.notes || '',
            standardCost: material.standardCost || 0,
            extendedCost,
            isPhantom: compDto.isPhantom || false,
            effectiveDate: compDto.effectiveDate ? new Date(compDto.effectiveDate) : null,
            expirationDate: compDto.expirationDate ? new Date(compDto.expirationDate) : null,
          });

          await queryRunner.manager.save(component);
        }
      }

      // Calculate total estimated cost
      const components = await queryRunner.manager.find(BomComponent, { where: { bomHeaderId: savedHeader.id } });
      const totalCost = components.reduce((sum, c) => sum + c.extendedCost, 0);
      savedHeader.estimatedCost = totalCost;
      await queryRunner.manager.save(savedHeader);

      await queryRunner.commitTransaction();
      return this.findBomHeaderById(savedHeader.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateBomHeader(id: number, dto: UpdateBomHeaderDto): Promise<BomHeader> {
    await this.findBomHeaderById(id);
    await this.headerRepo.update(id, dto);
    return this.findBomHeaderById(id);
  }

  async addComponentToBom(bomId: number, dto: CreateBomComponentDto): Promise<BomHeader> {
    const header = await this.findBomHeaderById(bomId);

    // Validate component exists in MaterialMaster
    const material = await this.materialRepo.findOne({ 
      where: { partNumber: dto.componentNumber } 
    });

    if (!material) {
      throw new BadRequestException(
        `Component ${dto.componentNumber} does not exist in Material Master. Please add it to inventory first.`
      );
    }

    // Check if component already exists in this BOM
    const existingComponent = await this.componentRepo.findOne({
      where: { bomHeaderId: bomId, componentNumber: dto.componentNumber }
    });

    if (existingComponent) {
      throw new BadRequestException(
        `Component ${dto.componentNumber} already exists in this BOM. Use update endpoint to modify.`
      );
    }

    const extendedCost = dto.quantity * (dto.usageFactor || 1) * (material.standardCost || 0);

    const component = this.componentRepo.create({
      bomHeaderId: bomId,
      level: dto.level || 1,
      componentNumber: dto.componentNumber,
      description: dto.description || material.description,
      quantity: dto.quantity,
      unit: dto.unit || material.uom || 'EA',
      usageFactor: dto.usageFactor || 1,
      referenceDesignator: dto.referenceDesignator || '',
      notes: dto.notes || '',
      standardCost: material.standardCost || 0,
      extendedCost,
      isPhantom: dto.isPhantom || false,
      effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
    });

    await this.componentRepo.save(component);

    // Recalculate total cost
    const components = await this.componentRepo.find({ where: { bomHeaderId: bomId } });
    const totalCost = components.reduce((sum, c) => sum + c.extendedCost, 0);
    await this.headerRepo.update(bomId, { estimatedCost: totalCost });

    return this.findBomHeaderById(bomId);
  }

  async updateComponent(bomId: number, componentId: number, dto: UpdateBomComponentDto): Promise<BomComponent> {
    const component = await this.componentRepo.findOne({ 
      where: { id: componentId, bomHeaderId: bomId } 
    });

    if (!component) {
      throw new NotFoundException(`Component ${componentId} not found in BOM ${bomId}`);
    }

    // If changing component number, validate new one exists in MaterialMaster
    if (dto.componentNumber && dto.componentNumber !== component.componentNumber) {
      const material = await this.materialRepo.findOne({ 
        where: { partNumber: dto.componentNumber } 
      });
      if (!material) {
        throw new BadRequestException(
          `New component ${dto.componentNumber} does not exist in Material Master.`
        );
      }
      component.standardCost = material.standardCost || 0;
    }

    await this.componentRepo.update(componentId, dto);
    
    // Recalculate extended cost and total BOM cost
    const updatedComponent = await this.componentRepo.findOne({ where: { id: componentId } });
    if (updatedComponent) {
      const extendedCost = updatedComponent.quantity * updatedComponent.usageFactor * updatedComponent.standardCost;
      await this.componentRepo.update(componentId, { extendedCost });
      
      const components = await this.componentRepo.find({ where: { bomHeaderId: bomId } });
      const totalCost = components.reduce((sum, c) => sum + c.extendedCost, 0);
      await this.headerRepo.update(bomId, { estimatedCost: totalCost });
    }

    const updated = await this.componentRepo.findOne({ where: { id: componentId } });
    if (!updated) {
      throw new NotFoundException(`Component ${componentId} not found`);
    }
    return updated;
  }

  async removeComponentFromBom(bomId: number, componentId: number): Promise<{ deleted: boolean; id: number }> {
    const component = await this.componentRepo.findOne({ 
      where: { id: componentId, bomHeaderId: bomId } 
    });

    if (!component) {
      throw new NotFoundException(`Component ${componentId} not found in BOM ${bomId}`);
    }

    await this.componentRepo.delete(componentId);

    // Recalculate total cost
    const components = await this.componentRepo.find({ where: { bomHeaderId: bomId } });
    const totalCost = components.reduce((sum, c) => sum + c.extendedCost, 0);
    await this.headerRepo.update(bomId, { estimatedCost: totalCost });

    return { deleted: true, id: componentId };
  }

  async approveBom(id: number, approvedBy: string): Promise<BomHeader> {
    const header = await this.findBomHeaderById(id);
    
    if (header.status === BomStatus.APPROVED || header.status === BomStatus.ACTIVE) {
      throw new BadRequestException('BOM is already approved or active');
    }

    if (!header.components || header.components.length === 0) {
      throw new BadRequestException('Cannot approve BOM without components');
    }

    await this.headerRepo.update(id, { 
      status: BomStatus.APPROVED, 
      approvedBy, 
      approvedAt: new Date() 
    });

    return this.findBomHeaderById(id);
  }

  async activateBom(id: number): Promise<BomHeader> {
    const header = await this.findBomHeaderById(id);
    
    if (header.status !== BomStatus.APPROVED) {
      throw new BadRequestException('BOM must be approved before activation');
    }

    await this.headerRepo.update(id, { status: BomStatus.ACTIVE });
    return this.findBomHeaderById(id);
  }

  async getBomTreeStructure(id: number): Promise<any> {
    const header = await this.findBomHeaderById(id);
    
    // Group components by level for tree visualization
    const componentsByLevel = header.components.reduce((acc, comp) => {
      const level = comp.level || 1;
      if (!acc[level]) acc[level] = [];
      acc[level].push(comp);
      return acc;
    }, {} as Record<number, typeof header.components>);

    return {
      header: {
        id: header.id,
        model: header.model,
        productName: header.productName,
        revision: header.revision,
        status: header.status,
        baseQuantity: header.baseQuantity,
        baseUnit: header.baseUnit,
        estimatedCost: header.estimatedCost,
      },
      components: header.components.map(c => ({
        id: c.id,
        level: c.level,
        componentNumber: c.componentNumber,
        description: c.description,
        quantity: c.quantity,
        unit: c.unit,
        usageFactor: c.usageFactor,
        referenceDesignator: c.referenceDesignator,
        standardCost: c.standardCost,
        extendedCost: c.extendedCost,
        isPhantom: c.isPhantom,
      })),
      structure: componentsByLevel,
    };
  }

  // ==================== LEGACY BOM ITEM METHODS ====================

  async findOne(id: number): Promise<BomItem> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`BomItem ${id} not found`);
    return item;
  }

  create(dto: CreateBomItemDto): Promise<BomItem> {
    const normalizedImageUrl = dto.imageUrl?.trim() || null;
    const item: BomItem = this.repo.create({
      unit: 'EA',
      ...dto,
      imageUrl: normalizedImageUrl,
      hasImage: dto.hasImage ?? !!normalizedImageUrl,
    }) as BomItem;
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateBomItemDto): Promise<BomItem> {
    await this.findOne(id);

    const normalizedImageUrl = dto.imageUrl?.trim();
    const hasImage =
      dto.hasImage !== undefined
        ? dto.hasImage
        : normalizedImageUrl !== undefined
          ? normalizedImageUrl.length > 0
          : undefined;

    await this.repo.update(id, {
      ...dto,
      imageUrl: normalizedImageUrl ?? dto.imageUrl,
      ...(hasImage !== undefined ? { hasImage } : {}),
    });

    return this.findOne(id);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true, id };
  }

  async importFromBuffer(
    buffer: Buffer,
  ): Promise<{ imported: number; errors: any[] }> {
    const { rows, errors } = parseBomXlsx(buffer);

    if (rows.length === 0) {
      return { imported: 0, errors };
    }

    // Upsert in chunks — avoids SQLite bind-parameter limits
    let imported = 0;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      await this.repo.upsert(chunk, ['model', 'partNumber']);
      imported += chunk.length;
    }

    return { imported, errors };
  }

  async syncCatalogFromKanban(
    buffer: Buffer,
  ): Promise<{ updated: number; catalogRows: number; matchedPartNumbers: number }> {
    const catalogRows = parseKanbanXlsx(buffer);
    if (catalogRows.length === 0) {
      return { updated: 0, catalogRows: 0, matchedPartNumbers: 0 };
    }

    const catalogByPartNumber = new Map(
      catalogRows.map(row => [row.partNumber, row] as const),
    );

    const partNumbers = [...catalogByPartNumber.keys()];
    const matchedItems: BomItem[] = [];

    for (let i = 0; i < partNumbers.length; i += UPSERT_CHUNK) {
      const chunk = partNumbers.slice(i, i + UPSERT_CHUNK);
      const items = await this.repo.findBy({ partNumber: In(chunk) });
      matchedItems.push(...items);
    }

    const changedItems = matchedItems
      .map(item => {
        const catalog = catalogByPartNumber.get(item.partNumber);
        if (!catalog) return null;

        const nextDescription = catalog.description ?? item.description ?? '';
        const nextLocation = catalog.location ?? item.location ?? '';
        const changed = nextDescription !== item.description || nextLocation !== item.location;

        if (!changed) return null;

        item.description = nextDescription;
        item.location = nextLocation;
        return item;
      })
      .filter((item): item is BomItem => item !== null);

    for (let i = 0; i < changedItems.length; i += UPSERT_CHUNK) {
      await this.repo.save(changedItems.slice(i, i + UPSERT_CHUNK));
    }

    return {
      updated: changedItems.length,
      catalogRows: catalogRows.length,
      matchedPartNumbers: new Set(matchedItems.map(item => item.partNumber)).size,
    };
  }
}
