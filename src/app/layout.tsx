import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { RouteLoader } from "@/components/RouteLoader";
import "./globals.css";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "WTMC Inventory Software",
    template: "%s · WTMC",
  },
  description: "Invoicing, inventory, expense and payroll software for Washika Tabassum Marwah Co. (WTMC)",
  icons: { icon: "/icon.svg", apple: "/logo.jpg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1f5fa8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <Suspense fallback={null}>
          <RouteLoader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
