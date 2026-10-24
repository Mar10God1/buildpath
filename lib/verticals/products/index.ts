import type { ProductConfig } from "../core/product";
import type { ProductKey } from "../core/types";
import { restore } from "./restore";
import { lease } from "./lease";
import { event } from "./event";

export const PRODUCTS: Record<ProductKey, ProductConfig> = { restore, lease, event };
export const PRODUCT_KEYS = Object.keys(PRODUCTS) as ProductKey[];

export function getProduct(key: string): ProductConfig | null {
  return (PRODUCTS as Record<string, ProductConfig>)[key] ?? null;
}
