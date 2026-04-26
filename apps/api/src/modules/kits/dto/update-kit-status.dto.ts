export class UpdateKitStatusDto {
  status:
    | 'preparing'
    | 'kitted'
    | 'ready'
    | 'requested'
    | 'delivered'
    | 'in_progress'
    | 'completed'
    | 'prepared'
    | 'sent'
    | 'received'; // legacy
}
