import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog open={false} onClose={() => {}} title="Hi" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows title and description when open', () => {
    render(<Dialog open onClose={() => {}} title="Delete?" description="Cannot undo" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Cannot undo')).toBeInTheDocument();
  });

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <Dialog open onClose={() => {}} title="Delete?" confirmLabel="Delete" destructive onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('fires onClose on Escape and on Cancel', () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="x" confirmLabel="Yes" onConfirm={() => {}} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
