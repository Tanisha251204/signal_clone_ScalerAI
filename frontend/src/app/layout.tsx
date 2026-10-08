import type { Metadata, Viewport } from "next";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Signal — Secure Messaging",
  description: "A Signal-inspired private messaging app: real-time chats, groups, receipts and more.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2c6bed" };

// Apply the saved theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem("signal.theme")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
