// Trust surface for the "your data stays on your machine" story (single copy
// source: @/shared/privacy). PrivacyBadge is a compact pill; clickable variants
// open PrivacyDialog with the full, truthful breakdown.
import { Lock, ShieldCheck } from 'lucide-react';
import { PRIVACY_TAGLINE, privacyPoints } from '@/shared/privacy';
import { cn } from './cn';
import { Button } from './Button';
import { Dialog } from './Dialog';

export function PrivacyBadge({ className, onClick }: { className?: string; onClick?: () => void }) {
  const classes = cn(
    'inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success',
    onClick && 'cursor-pointer transition-colors hover:bg-success/20',
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-label="How ApplyPilot protects your data">
        <Lock className="h-3 w-3" />
        {PRIVACY_TAGLINE}
      </button>
    );
  }
  return (
    <span className={classes}>
      <Lock className="h-3 w-3" />
      {PRIVACY_TAGLINE}
    </span>
  );
}

export function PrivacyDialog({
  open,
  onClose,
  keyEncrypted = false,
}: {
  open: boolean;
  onClose: () => void;
  keyEncrypted?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Your data stays on your device">
      <ul className="mt-3 flex flex-col gap-3">
        {privacyPoints(keyEncrypted).map((p) => (
          <li key={p.title} className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div>
              <div className="text-sm font-medium text-fg">{p.title}</div>
              <div className="text-xs text-fg-muted">{p.detail}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Dialog>
  );
}
