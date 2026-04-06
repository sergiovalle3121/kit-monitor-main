import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { MonitorComponent } from './monitor.component';

describe('MonitorComponent', () => {
  const apiMock = {
    getProductionBackends: jasmine.createSpy('getProductionBackends'),
    getProductionMaterials: jasmine.createSpy('getProductionMaterials'),
    getProductionEvents: jasmine.createSpy('getProductionEvents'),
  };

  beforeEach(async () => {
    apiMock.getProductionBackends.calls.reset();
    apiMock.getProductionMaterials.calls.reset();
    apiMock.getProductionEvents.calls.reset();

    await TestBed.configureTestingModule({
      imports: [MonitorComponent],
      providers: [{ provide: ApiService, useValue: apiMock }],
    }).compileComponents();
  });

  it('loads runtime data and aggregates bay totals', () => {
    apiMock.getProductionBackends.and.returnValue(
      of([
        {
          backen: 1,
          kitId: 77,
          status: 'in_progress',
          model: 'OP-520-0001',
          workOrder: 'WO-10',
          shift: 'A',
          targetQty: 40,
          completedQty: 10,
          hasIncident: true,
        },
      ]),
    );
    apiMock.getProductionMaterials.and.returnValue(
      of([
        { bayId: 3, consumedQty: 2 },
        { bayId: 3, consumedQty: 1.5 },
        { bayId: 1, consumedQty: 4 },
      ]),
    );
    apiMock.getProductionEvents.and.returnValue(of([{ bayId: 3, quantity: 5 }, { bayId: 1, quantity: 2 }]));

    const fixture = TestBed.createComponent(MonitorComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.loading).toBeFalse();
    expect(component.error).toBeNull();
    expect(component.slots[1].progressPct).toBe(25);
    expect(component.slots[1].hasException).toBeTrue();
    expect(component.slots[1].bays).toEqual([
      { bayId: 1, npCount: 1, consumed: 4, assembled: 2 },
      { bayId: 3, npCount: 2, consumed: 3.5, assembled: 5 },
    ]);
    expect(component.slots[2].status).toBe('empty');
  });

  it('prevents row expansion when there is no active operation', () => {
    apiMock.getProductionBackends.and.returnValue(of([]));

    const fixture = TestBed.createComponent(MonitorComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.isExpandable(1)).toBeFalse();
    component.toggleBk(1);
    expect(component.isExpanded(1)).toBeFalse();

    component.toggleAll();
    expect(component.allExpanded).toBeTrue();
    expect(component.backens.every((bk) => !component.isExpanded(bk))).toBeTrue();
  });
});
