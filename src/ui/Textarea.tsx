import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { controlBase, controlInvalid } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, 'resize-y', invalid && controlInvalid, className)}
      {...rest}
    />
  );
});
