"use client";

import { MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { AuthScreen } from "./AuthScreen";
import { Messenger } from "./Messenger";
import { Toasts } from "./Toasts";

export function AppShell() {
  const { booting, me, token } = useApp();
  return (
    <div className="h-dvh w-full">
      {booting ? (
        <div className="flex h-full items-center justify-center bg-bg" aria-label="Loading">
          <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-[22px] bg-outb text-white"><MessageCircle size={34} fill="currentColor" strokeWidth={1.5} /></div>
        </div>
      ) : token && me ? <Messenger /> : <AuthScreen />}
      <Toasts />
    </div>
  );
}
