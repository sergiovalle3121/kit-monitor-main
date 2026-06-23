import { DataSource } from 'typeorm';
import { PeopleService } from './people.service';
import { Certification } from './entities/certification.entity';
import { SkillCatalog } from './entities/skill-catalog.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('PeopleService (integration)', () => {
  let dataSource: DataSource;
  let service: PeopleService;
  const year = new Date().getFullYear();

  const inDays = (n: number) =>
    new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Certification, SkillCatalog, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new PeopleService(
      dataSource.getRepository(Certification),
      ctx,
      numbering,
      dataSource.getRepository(SkillCatalog),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates a certification with a CERT folio and derives VALID status', async () => {
    const c = await service.create({
      employeeName: 'Juan Pérez',
      skill: 'IPC-A-610',
      expiresDate: inDays(365),
    });
    expect(c.folio).toBe(`CERT-${year}-00001`);
    expect(c.status).toBe('VALID');
  });

  it('derives EXPIRING and EXPIRED from the expiry date', async () => {
    const soon = await service.create({ employeeName: 'A', skill: 'ESD', expiresDate: inDays(10) });
    expect(soon.status).toBe('EXPIRING');
    const old = await service.create({ employeeName: 'B', skill: 'ESD', expiresDate: inDays(-5) });
    expect(old.status).toBe('EXPIRED');
  });

  it('computes skills KPIs (valid, expiring buckets, coverage)', async () => {
    await service.create({ employeeName: 'A', skill: 'Soldadura', expiresDate: inDays(10) });
    await service.create({ employeeName: 'B', skill: 'Soldadura', expiresDate: inDays(400) });
    await service.create({ employeeName: 'C', skill: 'AOI', expiresDate: inDays(-1) });

    const kpis = await service.kpis();
    expect(kpis.total).toBe(3);
    expect(kpis.expired).toBe(1);
    expect(kpis.valid).toBe(2); // the two non-expired
    expect(kpis.expiring30).toBe(1); // the +10d one
    expect(kpis.employees).toBe(3);
    expect(kpis.skills).toBe(2);
    expect(kpis.coverage[0]).toEqual({ skill: 'Soldadura', count: 2 });
  });

  it('links to a real employee (employeeId) and trims/normalizes free text', async () => {
    const c = await service.create({
      employeeId: 'emp-123',
      employeeName: '  Juan   Pérez ',
      skill: '  Operación  SMT-1 ',
      station: ' SMT-1 ',
      expiresDate: inDays(200),
    });
    expect(c.employeeId).toBe('emp-123');
    expect(c.employeeName).toBe('Juan Pérez'); // collapsed whitespace
    expect(c.skill).toBe('Operación SMT-1');
    expect(c.station).toBe('SMT-1');
  });

  describe('certificationCheck (operator↔station gate)', () => {
    it('returns valid for a current cert (by employeeId, case-insensitive station)', async () => {
      await service.create({
        employeeId: 'emp-1',
        employeeName: 'Ana',
        skill: 'Operación SMT-1',
        station: 'SMT-1',
        expiresDate: inDays(120),
      });
      const r = await service.certificationCheck({ employeeId: 'emp-1', station: 'smt-1' });
      expect(r.certified).toBe(true);
      expect(r.status).toBe('valid');
      expect(r.matchedCertId).toBeTruthy();
    });

    it('flags expiring (still certified) and expired (not certified)', async () => {
      await service.create({ employeeId: 'e2', employeeName: 'Beto', skill: 'ESD', station: 'AOI-2', expiresDate: inDays(15) });
      await service.create({ employeeId: 'e3', employeeName: 'Caro', skill: 'ESD', station: 'AOI-3', expiresDate: inDays(-3) });

      const soon = await service.certificationCheck({ employeeId: 'e2', station: 'AOI-2' });
      expect(soon.status).toBe('expiring');
      expect(soon.certified).toBe(true);

      const old = await service.certificationCheck({ employeeId: 'e3', station: 'AOI-3' });
      expect(old.status).toBe('expired');
      expect(old.certified).toBe(false);
    });

    it('matches legacy certs by name when no employeeId, and reports none when uncertified', async () => {
      await service.create({ employeeName: 'Operador Viejo', skill: 'Prueba', station: 'TEST-1', expiresDate: inDays(90) });

      const byName = await service.certificationCheck({ employee: 'operador viejo', station: 'TEST-1' });
      expect(byName.certified).toBe(true);
      expect(byName.status).toBe('valid');

      const missing = await service.certificationCheck({ employee: 'Nadie', station: 'TEST-1' });
      expect(missing.status).toBe('none');
      expect(missing.certified).toBe(false);
    });
  });

  describe('skill catalog', () => {
    it('creates, normalizes and lists skills (active only by default)', async () => {
      const s = await service.createSkill({
        name: '  IPC-A-610  ',
        category: 'Calidad',
        defaultValidityMonths: 12,
      });
      expect(s.name).toBe('IPC-A-610');
      expect(s.defaultValidityMonths).toBe(12);

      const list = await service.listSkills();
      expect(list).toHaveLength(1);
    });

    it('is idempotent by name (case-insensitive) and reactivates archived', async () => {
      const a = await service.createSkill({ name: 'ESD' });
      const b = await service.createSkill({ name: 'esd' });
      expect(b.id).toBe(a.id); // reused, not duplicated

      await service.updateSkill(a.id, { active: false });
      expect(await service.listSkills()).toHaveLength(0); // archived hidden
      const c = await service.createSkill({ name: 'ESD' });
      expect(c.id).toBe(a.id);
      expect(c.active).toBe(true); // reactivated
      expect(await service.listSkills()).toHaveLength(1);
    });
  });
});
