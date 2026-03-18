export interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  size: string;
  color: string | null;
  price: number;
  quantity: number;
  image: string | null;
  slug: string;
}

export interface ProductWithDetails {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAt: number | null;
  featured: boolean;
  active: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  images: {
    id: string;
    url: string;
    alt: string | null;
    sortOrder: number;
  }[];
  variants: {
    id: string;
    size: string;
    color: string | null;
    stock: number;
    sku: string | null;
  }[];
}
