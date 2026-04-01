import { Test, TestingModule } from '@nestjs/testing';
import { KitsService } from './kits.service';

describe('KitsService', () => {
  let service: KitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KitsService],
    }).compile();

    service = module.get<KitsService>(KitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
