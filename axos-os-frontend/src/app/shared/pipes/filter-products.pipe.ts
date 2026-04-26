import { Pipe, PipeTransform } from '@angular/core';

export interface ProductSku {
  sku: string;
  model: string;
  description: string;
}

@Pipe({
  name: 'filterProducts',
  standalone: true,
})
export class FilterProductsPipe implements PipeTransform {
  transform(products: ProductSku[], searchQuery: string): ProductSku[] {
    if (!searchQuery || searchQuery.trim() === '') {
      return products;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return products.filter(product => 
      product.sku.toLowerCase().includes(query) ||
      product.model.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query)
    );
  }
}
