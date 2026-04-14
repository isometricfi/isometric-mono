"use client";

import { useMediaQuery } from "react-responsive";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useModal } from "@/hooks/use-modal";

export function ModalProvider() {
  const { isOpen, content, closeModal, fullscreen, minHeight, showCloseButton } = useModal();
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  if (!content) return null;

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && closeModal()}>
        <DrawerContent className={fullscreen ? "h-dvh! max-h-dvh! rounded-t-none!" : "px-4 pb-6"}>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        showCloseButton={showCloseButton}
        className="sm:max-w-md p-5 overflow-visible border-0"
        style={{ minHeight }}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
