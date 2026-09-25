import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/schema/JsonLd";
import { GcChrome } from "@/components/layout/GcChrome";

export default function GcLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <GcChrome>{children}</GcChrome>
    </>
  );
}
