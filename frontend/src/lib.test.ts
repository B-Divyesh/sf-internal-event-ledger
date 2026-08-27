import { describe, expect, it } from 'vitest';
import { escapeHtml, relativeTime, slugify } from './lib';

describe('interface helpers', () => {
  it('escapes event content before rendering', () => expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;'));
  it('creates valid aliases', () => expect(slugify(' Billing / Production ')).toBe('billing-production'));
  it('formats recent events calmly', () => expect(relativeTime(new Date(1_000_000).toISOString(), 1_020_000)).toBe('just now'));
});
