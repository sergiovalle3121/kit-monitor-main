import { strict as assert } from 'node:assert';
// @ts-expect-error Node strip-types executes the colocated .ts module directly.
import { activeMaterialRequestQueue, isActiveMaterialRequest, materialRequestContextLabel, summarizeMaterialRequestQueue } from './material-request-queue.ts';

const requests = [
  {
    id: 1,
    kitId: 10,
    requestedBy: 'ana@axos.test',
    status: 'fulfilled',
    createdAt: '2026-06-28T12:00:00.000Z',
  },
  {
    id: 2,
    kitId: 11,
    requestedBy: 'luis@axos.test',
    status: 'pending',
    createdAt: '2026-06-28T12:03:00.000Z',
  },
  {
    id: 3,
    kitId: 12,
    requestedBy: 'maria@axos.test',
    status: 'authorized',
    createdAt: '2026-06-28T12:02:00.000Z',
  },
  {
    id: 4,
    kitId: 13,
    requestedBy: 'noe@axos.test',
    status: 'rejected',
    createdAt: '2026-06-28T12:04:00.000Z',
  },
  {
    id: 5,
    kitId: 14,
    requestedBy: 'sofia@axos.test',
    status: 'pending',
    createdAt: null,
  },
] as const;

assert.equal(isActiveMaterialRequest('pending'), true);
assert.equal(isActiveMaterialRequest('authorized'), true);
assert.equal(isActiveMaterialRequest('fulfilled'), false);

assert.deepEqual(
  activeMaterialRequestQueue(requests).map((request) => request.id),
  [2, 3, 5],
);

assert.deepEqual(summarizeMaterialRequestQueue(requests), {
  active: 3,
  pending: 2,
  authorized: 1,
});

assert.equal(
  materialRequestContextLabel({
    id: 6,
    kitId: 15,
    requestedBy: 'ana@axos.test',
    status: 'pending',
    partNumber: 'PN-100',
    requestedQty: 24,
    unit: 'EA',
    station: 'ICT-10',
    line: '2',
  }),
  'PN-100 x24 EA · ICT-10 · linea 2',
);

console.log('material-request-queue: active queue sorting and summary passed');
