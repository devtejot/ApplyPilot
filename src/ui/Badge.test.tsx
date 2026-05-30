import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its content', () => {
    render(<Badge>auto</Badge>);
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('maps a variant to its token classes', () => {
    render(<Badge variant="ai">AI</Badge>);
    expect(screen.getByText('AI')).toHaveClass('text-info');
  });

  it('defaults to the neutral variant', () => {
    render(<Badge>x</Badge>);
    expect(screen.getByText('x')).toHaveClass('text-fg-muted');
  });
});
