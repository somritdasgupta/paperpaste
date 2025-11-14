"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export function ErrorDialog({
  open,
  onClose,
  title = "Error",
  message,
}: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-3 text-left">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} variant="default">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
