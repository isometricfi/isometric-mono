"use client";

import { useMediaQuery } from "react-responsive";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useModal } from "@/hooks/use-modal";

export function ModalProvider() {
  const { isOpen, content, closeModal } = useModal();
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  if (!content) return null;

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && closeModal()}>
        <DrawerContent className="px-4 pb-6 h-dvh! max-h-dvh! rounded-t-none!">
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-5 overflow-visible min-h-[600px] border-0"
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
