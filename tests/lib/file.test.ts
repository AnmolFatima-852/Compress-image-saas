import { describe, expect, it } from 'vitest';
import { validateImageFile } from '@/lib/file';

describe('validateImageFile', () => {
  it('accepts supported image files within the size limit', () => {
    const file = new File(['hello'], 'photo.png', { type: 'image/png' });

    const result = validateImageFile(file);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects unsupported mime types', () => {
    const file = new File(['hello'], 'document.pdf', { type: 'application/pdf' });

    const result = validateImageFile(file);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Unsupported');
  });
});
