import { VerticalLayout, verticalMetadata } from "@/components/verticals/product-layout";

export const metadata = verticalMetadata("lease");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <VerticalLayout product="lease">{children}</VerticalLayout>;
}
