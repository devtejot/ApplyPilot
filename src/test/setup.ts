// Vitest global setup: extends `expect` with jest-dom matchers for component
// tests (toBeInTheDocument, toHaveTextContent, etc.) and unmounts rendered trees
// after each test. Tests don't run with `globals: true`, so React Testing
// Library's auto-cleanup won't fire on its own — register it explicitly here,
// otherwise portal-based components (Dialog, Toast) accumulate in document.body.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
