"use client";

import { Clock } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button, Modal } from "../ui";

export function ComingSoonModal({ feature }: { feature: string }) {
  const { closeModal } = useApp();
  return (
    <Modal title={feature} onClose={closeModal}>
      <div className="flex flex-col items-center gap-3 px-8 pb-8 pt-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent"><Clock size={30} /></span>
        <p className="text-lg font-semibold">Coming soon</p>
        <p className="text-sm text-muted">{feature} aren&apos;t available in this version yet. Text messaging, groups and attachments are fully working.</p>
        <Button onClick={closeModal} className="mt-2 w-full">OK</Button>
      </div>
    </Modal>
  );
}
