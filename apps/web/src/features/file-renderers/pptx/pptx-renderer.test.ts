import { describe, expect, test } from 'bun:test';

import { resolvePptxSource } from './pptx-renderer';
import { ensurePresentationExtension, formatPresentationName } from './pptx-viewer';

describe('resolvePptxSource', () => {
  test('prefers blob over binaryUrl and returns a revocable object URL', () => {
    const blob = new Blob(['fake'], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const created: Blob[] = [];
    const result = resolvePptxSource({
      binaryUrl: 'blob:http://localhost/existing',
      blob,
      createObjectUrl: (b) => {
        created.push(b);
        return 'blob:mock-1';
      },
    });
    expect(result).toEqual({ src: 'blob:mock-1', revocable: true });
    expect(created).toEqual([blob]);
  });

  test('falls back to binaryUrl without creating an object URL', () => {
    const result = resolvePptxSource({
      binaryUrl: 'https://example.com/deck.pptx',
      createObjectUrl: () => {
        throw new Error('should not be called');
      },
    });
    expect(result).toEqual({ src: 'https://example.com/deck.pptx', revocable: false });
  });

  test('returns null src when no source is provided', () => {
    const result = resolvePptxSource({ createObjectUrl: () => 'blob:never' });
    expect(result).toEqual({ src: null, revocable: false });
  });
});

describe('formatPresentationName', () => {
  test('prefers the explicit file name', () => {
    expect(formatPresentationName('Deck.pptx', 'blob:http://localhost/abc-123')).toBe('Deck.pptx');
  });

  test('derives the name from the URL path when no file name is given', () => {
    expect(formatPresentationName(undefined, 'https://example.com/decks/Q3%20Review.pptx?v=2')).toBe(
      'Q3 Review.pptx',
    );
  });

  test('falls back to presentation.pptx for a bare URL', () => {
    expect(formatPresentationName('  ', 'https://example.com/')).toBe('presentation.pptx');
  });
});

describe('ensurePresentationExtension', () => {
  test('passes through .pptx and .ppt names (case-insensitive)', () => {
    expect(ensurePresentationExtension('Deck.pptx')).toBe('Deck.pptx');
    expect(ensurePresentationExtension('Deck.PPT')).toBe('Deck.PPT');
  });

  test('appends .pptx to a bare name', () => {
    expect(ensurePresentationExtension('Deck')).toBe('Deck.pptx');
  });
});
