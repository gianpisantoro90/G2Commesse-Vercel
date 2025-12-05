import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Project } from "@shared/schema";
import PrestazioniTracker from "./prestazioni-tracker";

interface PrestazioniTrackerModalProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}

export default function PrestazioniTrackerModal({ project, open, onClose }: PrestazioniTrackerModalProps) {
  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Tracking Prestazioni - {project.code}
          </DialogTitle>
          <DialogDescription>
            {project.client} - {project.object}
          </DialogDescription>
        </DialogHeader>

        <PrestazioniTracker project={project} />
      </DialogContent>
    </Dialog>
  );
}
