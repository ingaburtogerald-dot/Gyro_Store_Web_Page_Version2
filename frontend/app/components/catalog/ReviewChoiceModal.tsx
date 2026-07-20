import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { GOOGLE_REVIEW_URL, FACEBOOK_REVIEW_URL } from "~/lib/storeLinks";

interface ReviewChoiceModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReviewChoiceModal({ open, onClose }: ReviewChoiceModalProps) {
  const { data: config } = useGetConfigQuery();
  const googleUrl = config?.reviewLinks?.google || GOOGLE_REVIEW_URL;
  const facebookUrl = config?.reviewLinks?.facebook || FACEBOOK_REVIEW_URL;

  return (
    <Modal open={open} onClose={onClose} title="¿Dónde querés dejar tu reseña?" maxWidth="max-w-sm">
      <div className="flex flex-col gap-3 mt-4">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}>
          <Button className="w-full h-11 bg-surface-2 hover:bg-surface-3 text-text border border-border">
            ⭐ Google
          </Button>
        </a>
        {facebookUrl && (
          <a href={facebookUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            <Button className="w-full h-11 bg-[#1877F2] hover:bg-[#166FE5] text-white border border-transparent">
              <span className="mr-2 font-serif font-bold text-lg">f</span> Facebook
            </Button>
          </a>
        )}
      </div>
    </Modal>
  );
}
