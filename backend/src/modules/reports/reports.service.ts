import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { User } from '../users/entities/user.entity';
import { Model } from '../models/entities/model.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Model)
    private readonly modelsRepository: Repository<Model>,
  ) {}

  async create(createReportDto: CreateReportDto): Promise<Report> {
    const user = await this.usersRepository.findOneBy({ id: createReportDto.userId });
    const model = await this.modelsRepository.findOneBy({ id: createReportDto.modelId });

    const report = this.reportsRepository.create({
      title: createReportDto.title,
      content: createReportDto.content || '',
      details: createReportDto.details || '',
      user: user || undefined,
      model: model || undefined,
    });

    return this.reportsRepository.save(report);
  }

  async findAll(): Promise<Report[]> {
    return this.reportsRepository.find({ relations: ['user', 'model'] });
  }

  async findOne(id: number): Promise<Report> {
    const report = await this.reportsRepository.findOne({ where: { id }, relations: ['user', 'model'] });
    if (!report) throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    return report;
  }

  async update(id: number, updateReportDto: UpdateReportDto): Promise<Report> {
    const report = await this.findOne(id);

    const user = updateReportDto.userId
      ? await this.usersRepository.findOneBy({ id: updateReportDto.userId })
      : undefined;

    const model = updateReportDto.modelId
      ? await this.modelsRepository.findOneBy({ id: updateReportDto.modelId })
      : undefined;

    const updated = Object.assign(report, {
      title: updateReportDto.title || report.title,
      content: updateReportDto.content || report.content,
      details: updateReportDto.details || report.details,
      user: user || report.user,
      model: model || report.model,
    });

    return this.reportsRepository.save(updated);
  }

  async remove(id: number): Promise<void> {
    const report = await this.findOne(id);
    await this.reportsRepository.remove(report);
  }
}
