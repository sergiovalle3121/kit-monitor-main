/**
 * AXOS OS — Verificación del golden path con los datos semilla DEMO.
 *
 * Esto es lo que prueba que NO es maqueta: corre CONSULTAS REALES y comprueba
 *   • cada modelo AX- existe y está ACTIVE;
 *   • cada modelo tiene un BOM ACTIVE con todos sus componentes;
 *   • hay planes publicados;
 *   • el surtido/kit tiene líneas explotadas del BOM (qty = qtyPorUnidad × cantidadPlan);
 *   • la valuación de inventario (Σ onHand × standardCost) da > 0.
 *
 * Sale con código ≠ 0 si alguna verificación falla (sirve de reja real).
 *
 * Uso: DATABASE_URL=... npm run seed:demo:verify
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { ProductModel } from '../modules/product-models/entities/product-model.entity';
import { BomHeader, BomStatus } from '../modules/bom/entities/bom-header.entity';
import { Plan } from '../modules/plans/entities/plan.entity';
import { InventoryPosition } from '../modules/inventory/entities/inventory-position.entity';
import { InventoryMovement } from '../modules/inventory/entities/inventory-movement.entity';
import { MaterialMaster } from '../modules/inventory/entities/material-master.entity';
import { LineEngineeringService } from '../modules/line-engineering/line-engineering.service';
import { WorkOrderExecution } from '../modules/mes-execution/entities/work-order-execution.entity';
import { ExecutionStep } from '../modules/mes-execution/entities/execution-step.entity';
import { VisualAid } from '../modules/visual-aids/entities/visual-aid.entity';

import { bootSeedContext, runInDemoContext } from './seed-context';
import {
  DEMO_BOM_REVISION,
  DEMO_MODELS,
  DEMO_PART_NUMBERS,
  DEMO_PLANS,
  DEMO_ROUTING_REVISION,
} from './seed-constants';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
function check(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} ${name} — ${detail}`);
}

async function run(): Promise<void> {
  console.log('════════════════════════════════════════════════════════════');
  console.log(' AXOS OS — Verificación del golden path (datos semilla DEMO)');
  console.log('════════════════════════════════════════════════════════════');

  const app = await bootSeedContext();
  const ds = app.get(DataSource);

  try {
    const modelRepo = ds.getRepository(ProductModel);
    const headerRepo = ds.getRepository(BomHeader);
    const planRepo = ds.getRepository(Plan);

    // ── 1. Modelos ACTIVE ─────────────────────────────────────────────────
    console.log('\n· Modelos');
    let activeModels = 0;
    for (const m of DEMO_MODELS) {
      const row = await modelRepo.findOne({ where: { modelNumber: m.modelNumber } });
      const ok = !!row && row.status === 'ACTIVE';
      if (ok) activeModels++;
      check(`modelo ${m.modelNumber}`, ok, row ? `status=${row.status}` : 'no encontrado');
    }
    check('modelos ACTIVE', activeModels === DEMO_MODELS.length, `${activeModels}/${DEMO_MODELS.length}`);

    // ── 2. BOM ACTIVE con todos sus componentes ───────────────────────────
    console.log('\n· BOM');
    let activeBoms = 0;
    for (const m of DEMO_MODELS) {
      const header = await headerRepo.findOne({
        where: { model: m.modelNumber, revision: DEMO_BOM_REVISION },
        relations: ['components'],
      });
      const compCount = header?.components?.length ?? 0;
      const ok = !!header && header.status === BomStatus.ACTIVE && compCount === m.bom.length;
      if (ok) activeBoms++;
      check(
        `bom ${m.modelNumber}`,
        ok,
        header ? `status=${header.status} componentes=${compCount}/${m.bom.length} costo=$${Number(header.estimatedCost).toFixed(4)}` : 'no encontrado',
      );
    }
    check('BOMs ACTIVE', activeBoms === DEMO_MODELS.length, `${activeBoms}/${DEMO_MODELS.length}`);

    // ── 3. Planes publicados + explosión de BOM en el kit ─────────────────
    console.log('\n· Planes publicados + surtido (kit)');
    const expectedPublished = DEMO_PLANS.filter((p) => p.publish);
    let publishedOk = 0;
    let explosionOk = 0;
    for (const p of expectedPublished) {
      const plan = await planRepo.findOne({
        where: { workOrder: p.workOrder },
        relations: ['kit', 'kit.materials'],
      });
      const isPublished = !!plan && plan.status === 'published' && !!plan.kit;
      if (isPublished) publishedOk++;

      const model = DEMO_MODELS.find((m) => m.modelNumber === p.model)!;
      const materials = plan?.kit?.materials ?? [];
      const lineCountOk = materials.length === model.bom.length;

      // qty kit = qtyPorUnidad × cantidadPlan, para cada línea
      let mathOk = lineCountOk && materials.length > 0;
      let sample = '';
      for (const mat of materials) {
        const comp = model.bom.find((b) => b.part === mat.partNumber);
        if (!comp) {
          mathOk = false;
          continue;
        }
        const expected = comp.qty * p.quantity;
        if (Math.abs(Number(mat.quantityRequired) - expected) > 1e-6) mathOk = false;
        if (!sample) sample = `${mat.partNumber}: ${mat.quantityRequired} (=${comp.qty}×${p.quantity})`;
      }
      if (mathOk) explosionOk++;

      check(
        `plan ${p.workOrder} (${p.model})`,
        isPublished && mathOk,
        isPublished
          ? `kit#${plan!.kit.id} líneas=${materials.length}/${model.bom.length} · ej. ${sample}`
          : 'no publicado / sin kit',
      );
    }
    check('planes publicados', publishedOk === expectedPublished.length, `${publishedOk}/${expectedPublished.length}`);
    check('explosión BOM correcta', explosionOk === expectedPublished.length, `${explosionOk}/${expectedPublished.length}`);

    // ── 4. Inventario: posiciones, movimientos y valuación > 0 ─────────────
    console.log('\n· Inventario');
    const positionsCount = await ds.getRepository(InventoryPosition).count();
    const movementsCount = await ds.getRepository(InventoryMovement).count();
    const valRow = await ds
      .getRepository(InventoryPosition)
      .createQueryBuilder('pos')
      .innerJoin(MaterialMaster, 'mat', 'mat.partNumber = pos.partNumber')
      .select('COALESCE(SUM(pos.onHand * mat.standardCost), 0)', 'value')
      .getRawOne<{ value: string }>();
    const valuation = Number(valRow?.value ?? 0);

    const heldCount = await ds
      .getRepository(InventoryPosition)
      .createQueryBuilder('pos')
      .where("pos.holdStatus <> 'available'")
      .getCount();

    check('posiciones de inventario', positionsCount > 0, `${positionsCount} posiciones`);
    check('movimientos de inventario', movementsCount > 0, `${movementsCount} movimientos (recibo/consumo)`);
    check('existencias en calidad (hold)', heldCount > 0, `${heldCount} posiciones en cuarentena/inspección`);
    check('valuación inventario > 0', valuation > 0, `$${valuation.toFixed(2)} USD sobre ${DEMO_PART_NUMBERS.length} partes demo`);

    // ── 5. Ruteo por estación: NP esperado por modelo AX (sustrato de surtido) ──
    // SfLineStation es tenant-scoped → se consulta en el MISMO ámbito demo (nulo)
    // que usó la siembra, para que stationRequirements case (si no, saldría vacío).
    console.log('\n· Ruteo / layout por estación (NP por estación)');
    const lineEng = app.get(LineEngineeringService, { strict: false });
    let modelsWithRoute = 0;
    await runInDemoContext(app, async () => {
      for (const m of DEMO_MODELS) {
        const reqs = await lineEng.stationRequirements(m.modelNumber, DEMO_ROUTING_REVISION);
        const withNp = reqs.filter((r) => !!r.npExpected);
        const ok = withNp.length > 0;
        if (ok) modelsWithRoute++;
        check(
          `ruteo ${m.modelNumber}`,
          ok,
          reqs.length
            ? `${withNp.length}/${reqs.length} estaciones con NP · ej. ${withNp[0]?.station}:${withNp[0]?.npExpected}`
            : 'sin ruteo (stationRequirements vacío)',
        );
      }
    });
    check('ruteo con NP por modelo AX', modelsWithRoute === DEMO_MODELS.length, `${modelsWithRoute}/${DEMO_MODELS.length}`);

    // ── 6. Ejecución MES en curso: ≥1 paso in_process (operador con WO viva) ──
    console.log('\n· Ejecución MES en curso');
    const execOpen = await ds.getRepository(WorkOrderExecution).count({ where: { status: 'open' } });
    const inProcessSteps = await ds.getRepository(ExecutionStep).count({ where: { status: 'in_process' } });
    check('≥1 ejecución MES abierta', execOpen >= 1, `${execOpen} ejecución(es) abierta(s)`);
    check('≥1 paso in_process', inProcessSteps >= 1, `${inProcessSteps} paso(s) en proceso (operador puede dar consumo)`);

    // ── 7. Ayudas visuales por modelo (enlazadas desde el ruteo) ──
    console.log('\n· Ayudas visuales por modelo');
    const vaRepo = ds.getRepository(VisualAid);
    let modelsWithAid = 0;
    for (const m of DEMO_MODELS) {
      const aids = await vaRepo.count({ where: { model: m.modelNumber, isActive: true } });
      const ok = aids > 0;
      if (ok) modelsWithAid++;
      check(`ayudas visuales ${m.modelNumber}`, ok, `${aids} activa(s)`);
    }
    check('ayudas visuales por modelo AX', modelsWithAid === DEMO_MODELS.length, `${modelsWithAid}/${DEMO_MODELS.length}`);

    // ── Resultado ─────────────────────────────────────────────────────────
    const failed = checks.filter((c) => !c.ok);
    console.log('\n────────────────────────────────────────────────────────────');
    if (failed.length === 0) {
      console.log(`✅ GOLDEN PATH OK — ${checks.length} verificaciones pasaron.`);
    } else {
      console.log(`❌ FALLARON ${failed.length}/${checks.length} verificaciones:`);
      for (const f of failed) console.log(`   - ${f.name}: ${f.detail}`);
    }
    console.log('────────────────────────────────────────────────────────────');

    await app.close();
    process.exit(failed.length === 0 ? 0 : 1);
  } catch (err) {
    await app.close();
    console.error('❌ Verificación falló:', err);
    process.exit(1);
  }
}

run();
