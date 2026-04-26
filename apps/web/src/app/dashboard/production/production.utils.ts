import type { KanbanColumn, OeeFactors, WorkOrder, WorkOrderStatus } from "./production.types";

export const workOrderStatuses: WorkOrderStatus[] = [
  "Pending",
  "In Progress",
  "Quality Check",
  "Completed",
];

export const calculateOee = ({ availability, performance, quality }: OeeFactors) => {
  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
  const score =
    (clampPercent(availability) / 100) *
    (clampPercent(performance) / 100) *
    (clampPercent(quality) / 100);

  return Number((score * 100).toFixed(1));
};

export const getWorkOrderProgress = (workOrder: WorkOrder) => {
  if (workOrder.quantity <= 0) return 0;
  return Math.min(100, Math.round((workOrder.completedQuantity / workOrder.quantity) * 100));
};

export const groupWorkOrdersByStatus = (workOrders: WorkOrder[]): KanbanColumn[] =>
  workOrderStatuses.map((status) => ({
    id: status,
    title: status,
    workOrders: workOrders.filter((workOrder) => workOrder.status === status),
  }));

export const moveWorkOrder = (
  workOrders: WorkOrder[],
  workOrderId: WorkOrder["id"],
  nextStatus: WorkOrderStatus,
) =>
  workOrders.map((workOrder) =>
    workOrder.id === workOrderId ? { ...workOrder, status: nextStatus } : workOrder,
  );
