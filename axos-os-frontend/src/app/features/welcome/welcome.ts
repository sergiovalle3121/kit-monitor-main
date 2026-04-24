import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EnterpriseContextService } from '../../core/enterprise-context.service';

interface FeatureCard {
  title: string;
  description: string;
  icon: string;
  route: string;
  tag?: string;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css']
})
export class WelcomeComponent implements OnInit {
  private readonly contextService = inject(EnterpriseContextService);
  
  readonly context = this.contextService.context;
  
  readonly buildingName = computed(() => {
    const id = this.context().buildingId;
    return this.contextService.buildings().find(b => b.id === id)?.name || 'Edificio Seleccionado';
  });

  readonly projectName = computed(() => {
    const id = this.context().programId;
    return this.contextService.programs().find(p => p.id === id)?.name || 'Proyecto Seleccionado';
  });

  readonly features: FeatureCard[] = [
    {
      title: 'Visual Aids Editor',
      description: 'Crea y gestiona ayudas visuales dinámicas con nuestro editor basado en Fabric.js. Soporte para capas, imágenes y anotaciones.',
      icon: 'fa-magic',
      route: '/visual-aids',
      tag: 'Nuevo'
    },
    {
      title: 'Plant Layout Design',
      description: 'Diseño CAD de planta con snapping a rejilla. Planifica la disposición de maquinaria y estaciones de trabajo con precisión milimétrica.',
      icon: 'fa-drafting-compass',
      route: '/plant-layout'
    },
    {
      title: 'Control Tower',
      description: 'Monitoreo en tiempo real de todas las líneas de producción. Visualiza el OEE, KPIs y alertas críticas desde una sola pantalla.',
      icon: 'fa-broadcast-tower',
      route: '/control-tower'
    },
    {
      title: 'Materials & Inventory',
      description: 'Control total de existencias y movimientos. Gestión de Warehouse Network con trazabilidad completa de materiales.',
      icon: 'fa-box-open',
      route: '/materials/inventory'
    },
    {
      title: 'Quality & Compliance',
      description: 'Gestión de NCRs y auditorías de calidad. Asegura que cada unidad producida cumpla con los estándares más altos.',
      icon: 'fa-shield-check',
      route: '/quality-center'
    },
    {
      title: 'Production Scheduling',
      description: 'Planeación inteligente de la producción. Optimiza las cargas de trabajo por turno y edificio.',
      icon: 'fa-calendar-alt',
      route: '/scheduling-center'
    }
  ];

  ngOnInit(): void {
    // Slogan animation or analytics tracking could go here
  }
}
