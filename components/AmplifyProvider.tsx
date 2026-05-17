"use client";

import "@/lib/amplify/configure-client";
import type { ReactNode } from "react";

type AmplifyProviderProps = {
  children: ReactNode;
};

export function AmplifyProvider({ children }: AmplifyProviderProps) {
  return <>{children}</>;
}
