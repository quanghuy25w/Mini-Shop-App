export interface Category {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: string;
}

export interface Product {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  price: number;
  importPrice: number;
  unit: string;
  imageUrl: string;
  description: string;
  isFeatured: boolean;
  createdAt: string;
}

export interface Inventory {
  productId: string;
  stockQuantity: number;
  minimumStock: number;
  lastUpdated: string;
}

export type InventoryTransactionType = 'IMPORT' | 'EXPORT' | 'SALE';

export interface InventoryTransaction {
  id: string;
  productId: string;
  type: InventoryTransactionType;
  quantity: number;
  unitPrice: number;
  createdAt: string;
  note: string;
}

export interface Order {
  id: string;
  totalAmount: number;
  createdAt: string;
  status: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
}

export interface AppDataSchema {
  categories: Category[];
  products: Product[];
  inventory: Inventory[];
  transactions: InventoryTransaction[];
  orders: Order[];
  orderItems?: OrderItem[];
}
