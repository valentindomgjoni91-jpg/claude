import { useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 72; // px to reveal delete button

export function SwipeToDelete({ onDelete, children, disabled }: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const lockAxis = useRef<'x' | 'y' | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
    lockAxis.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || disabled) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!lockAxis.current) {
      lockAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (lockAxis.current === 'y') return;

    e.preventDefault();
    const clamped = Math.max(-THRESHOLD, Math.min(0, dx + (revealed ? -THRESHOLD : 0)));
    setOffset(clamped);
  };

  const handleTouchEnd = () => {
    if (!dragging.current || disabled) return;
    dragging.current = false;
    if (offset < -THRESHOLD / 2) {
      setOffset(-THRESHOLD);
      setRevealed(true);
    } else {
      setOffset(0);
      setRevealed(false);
    }
  };

  const handleDelete = () => {
    setOffset(0);
    setRevealed(false);
    onDelete();
  };

  const handleBackdropClick = () => {
    setOffset(0);
    setRevealed(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Red delete button behind */}
      <div className="absolute inset-y-0 right-0 w-18 flex items-center justify-center bg-red-500 rounded-2xl px-4">
        <button onClick={handleDelete} className="flex flex-col items-center gap-1 text-white">
          <Trash2 size={18} />
          <span className="text-[10px] font-medium">Löschen</span>
        </button>
      </div>

      {/* Backdrop to close */}
      {revealed && (
        <div className="fixed inset-0 z-10" onClick={handleBackdropClick} />
      )}

      {/* Swipeable content */}
      <div
        className="relative z-20 transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
