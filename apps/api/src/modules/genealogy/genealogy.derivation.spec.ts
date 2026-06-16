import {
  aggregateWhereUsed,
  buildAsBuiltTree,
  GenealogyLink,
} from './genealogy.derivation';

function link(p: Partial<GenealogyLink>): GenealogyLink {
  return {
    builtSerial: 'SN-1',
    part: 'P1',
    lot: null,
    reel: null,
    qty: 1,
    woId: null,
    woFolio: null,
    model: null,
    station: null,
    operator: null,
    consumedAt: null,
    source: 'TEST',
    sourceEventId: null,
    ...p,
  };
}

describe('genealogy derivation (pure)', () => {
  describe('buildAsBuiltTree', () => {
    it('groups by NP, dedupes lots/reels, sums qty and bounds the build window', () => {
      const links = [
        link({ part: 'P2', lot: 'L2', qty: 1, station: 'EST-20', operator: 'b@x', consumedAt: '2026-06-10T10:00:00.000Z', woFolio: 'WO-1', model: 'M' }),
        link({ part: 'P1', lot: 'L1', reel: 'R1', qty: 2, station: 'EST-10', operator: 'a@x', consumedAt: '2026-06-10T09:00:00.000Z', woFolio: 'WO-1', model: 'M' }),
        link({ part: 'P1', lot: 'L1b', qty: 1, station: 'EST-10', operator: 'a@x', consumedAt: '2026-06-10T09:30:00.000Z' }),
      ];
      const tree = buildAsBuiltTree('SN-1', links);

      expect(tree.serial).toBe('SN-1');
      expect(tree.componentCount).toBe(2);
      expect(tree.model).toBe('M');
      expect(tree.woFolio).toBe('WO-1');
      // sorted by part: P1 first
      const [p1, p2] = tree.parts;
      expect(p1.part).toBe('P1');
      expect(p1.totalQty).toBe(3);
      expect(p1.lots).toEqual(['L1', 'L1b']);
      expect(p1.reels).toEqual(['R1']);
      expect(p1.consumptions).toHaveLength(2);
      expect(p2.part).toBe('P2');
      expect(p2.totalQty).toBe(1);
      expect(tree.lotCaptureGap).toBe(false);
      expect(tree.firstBuiltAt).toBe('2026-06-10T09:00:00.000Z');
      expect(tree.lastBuiltAt).toBe('2026-06-10T10:00:00.000Z');
    });

    it('flags the lot-capture gap when a consumption has no lot', () => {
      const tree = buildAsBuiltTree('SN-2', [
        link({ part: 'P1', lot: null, station: 'EST-10', operator: 'a@x' }),
      ]);
      expect(tree.lotCaptureGap).toBe(true);
      expect(tree.parts[0].lots).toEqual([]);
      // station/operator genealogy is still present even without lot
      expect(tree.parts[0].consumptions[0].station).toBe('EST-10');
      expect(tree.parts[0].consumptions[0].operator).toBe('a@x');
    });
  });

  describe('aggregateWhereUsed (recall containment)', () => {
    it('rolls a defective lot up to the distinct serials, shipments and customers', () => {
      const links = [
        link({ builtSerial: 'SN-1', part: 'P1', lot: 'L1' }),
        link({ builtSerial: 'SN-2', part: 'P1', lot: 'L1' }),
        link({ builtSerial: 'SN-1', part: 'P1', lot: 'L1' }), // duplicate serial
      ];
      const shipmentLinks = [
        { builtSerial: 'SN-1', shipmentId: 's1', shipmentFolio: 'SHP-1', asn: 'ASN-1', customerName: 'ACME', destination: 'MX', shippedAt: '2026-06-12T00:00:00.000Z' },
        { builtSerial: 'SN-3', shipmentId: 's9', shipmentFolio: 'SHP-9', asn: null, customerName: 'OTHER', destination: null, shippedAt: null },
      ];
      const res = aggregateWhereUsed({ lot: 'L1', reel: null, part: null }, links, shipmentLinks);

      expect(res.serialCount).toBe(2);
      expect(res.recallScope.serials).toEqual(['SN-1', 'SN-2']);
      expect(res.shipmentCount).toBe(1); // only SN-1 is shipped
      expect(res.shipments[0].shipmentFolio).toBe('SHP-1');
      expect(res.recallScope.shipments).toEqual(['SHP-1']);
      expect(res.recallScope.customers).toEqual(['ACME']);
    });
  });
});
