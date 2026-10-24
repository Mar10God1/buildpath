import { StoreProvider } from "@/lib/verticals/store";
import { PRODUCTS } from "@/lib/verticals/products";
import type { ProductKey } from "@/lib/verticals/core/types";
import "./verticals.css";

/** Shared layout for each branded vertical route (/restorepath, /leasepath, /eventpath). */
export function verticalMetadata(product: ProductKey) {
  const p = PRODUCTS[product];
  return { title: `${p.name} | ${p.tagline}`, description: p.pitch[0] };
}

export function VerticalLayout({ product, children }: { product: ProductKey; children: React.ReactNode }) {
  return (
    <div className="vp-root">
      <StoreProvider product={product}>{children}</StoreProvider>
    </div>
  );
}
