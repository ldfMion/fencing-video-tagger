import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const designThemeScript = `
  try {
    localStorage.setItem("fencing-video-tagger-design-theme", "linear");
    document.documentElement.dataset.designTheme = "linear";
  } catch (_) {
    document.documentElement.dataset.designTheme = "linear";
  }
`;

export const metadata: Metadata = {
  title: "Fencing Video Tagger",
  description: "Analyze fencing videos with timestamped tags",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="font-sans"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: designThemeScript }} />
      </head>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
