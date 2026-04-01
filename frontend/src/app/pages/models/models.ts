import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';

type Model = { id: number; name: string; };

@Component({
  selector: 'app-models',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './models.html',
  styleUrls: ['./models.css']
})
export class ModelsComponent {
  models: Model[] = [];
  private api = inject(ApiService);

  ngOnInit() {
    this.api.get<Model[]>('/models').subscribe((res: Model[]) => (this.models = res));
  }
}
