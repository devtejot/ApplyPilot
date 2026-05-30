import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';
import { controlBase, controlInvalid } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, invalid && controlInvalid, className)} {...rest} />;
});
