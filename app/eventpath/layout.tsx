import { VerticalLayout, verticalMetadata } from "@/components/verticals/product-layout";

export const metadata = verticalMetadata("event");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <VerticalLayout product="event">{children}</VerticalLayout>;
}
