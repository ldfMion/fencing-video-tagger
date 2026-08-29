"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { DesignThemeProvider } from "@/components/design-theme-provider";
import { VideoProvider } from "@/contexts/video-context";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="fencing-video-tagger-theme"
        disableTransitionOnChange
      >
        <DesignThemeProvider>
          <VideoProvider>{children}</VideoProvider>
        </DesignThemeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
