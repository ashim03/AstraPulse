import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · HR, Payroll & Accounting`,
    template: `%s · ${APP_NAME}`,
  },
  description: "AstraPulse — HR management, payroll and accounting for small and medium businesses.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}