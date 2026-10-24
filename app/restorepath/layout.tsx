import { VerticalLayout, verticalMetadata } from "@/components/verticals/product-layout";

export const metadata = verticalMetadata("restore");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <VerticalLayout product="restore">{children}</VerticalLayout>;
}
