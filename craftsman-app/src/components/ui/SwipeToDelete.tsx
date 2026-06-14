import { useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

const DELETE_WIDTH = 80;

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: ReactNode;
}

export function SwipeToDelete({ onDelete, children }: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const axis = useRef<'x' | 'y' | null>(null);
  const isRevealed = offset <= -DELETE_WIDTH / 2;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    axis.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!axis.current) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axis.current === 'y') return;
    e.preventDefault();
    const base = isRevealed ? -DELETE_WIDTH : 0;
    const next = Math.max(-DELETE_WIDTH, Math.min(0, base + dx));
    setOffset(next);
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    setOffset(offset < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0);
  };

  const close = () => setOffset(0);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete button — always behind, no z-index needed */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 rounded-2xl"
        style={{ width: DELETE_WIDTH }}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex flex-col items-center gap-1 text-white w-full h-full justify-center"
        >
          <Trash2 size={20} />
          <span className="text-[10px] font-semibold">Löschen</span>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={isRevealed ? close : undefined}
      >
        {children}
      </div>
    </div>
  );
}
