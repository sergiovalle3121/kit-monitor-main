export type WorkOrderStatus =
  | "Pending"
  | "In Progress"
  | "Quality Check"
  | "Completed";

export type WorkOrderPriority = "Low" | "Medium" | "High" | "Urgent";

export interface WorkOrder {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  completedQuantity: number;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  lineId: string;
  stationId?: string;
  dueDate: string;
  operator?: string;
}

export interface KanbanColumn {
  id: WorkOrderStatus;
  title: WorkOrderStatus;
  workOrders: WorkOrder[];
}

export interface WorkOrderDragPayload {
  workOrderId: WorkOrder["id"];
  fromStatus: WorkOrderStatus;
  fromIndex: number;
}

export interface WorkOrderDropTarget {
  toStatus: WorkOrderStatus;
  toIndex: number;
}

export interface WorkOrderMoveIntent extends WorkOrderDragPayload, WorkOrderDropTarget {}

export interface OeeFactors {
  availability: number;
  performance: number;
  quality: number;
}
