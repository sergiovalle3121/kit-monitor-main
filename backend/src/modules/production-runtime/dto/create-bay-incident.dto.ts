export class CreateBayIncidentDto {
  type: 'Falta material' | 'Error de ensamble' | 'Paro de estación' | 'Otro';
  note?: string;
  operator?: string;
}
