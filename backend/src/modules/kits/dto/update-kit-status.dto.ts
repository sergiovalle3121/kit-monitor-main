export class UpdateKitStatusDto {
  status: 'prepared' | 'sent' | 'received' | 'in_progress' | 'completed';
}
