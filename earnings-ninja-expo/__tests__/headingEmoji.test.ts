// Heading emoji customization: grapheme-safe emoji handling + override
// application. One visible emoji can span many code points (ZWJ sequences,
// skin tones, flags) — never validate with value.length.
import {
  firstGrapheme,
  DEFAULT_HEADING_EMOJI,
  applyLabelOverrides,
  headingEmoji,
  headingLabel,
} from '../lib/platforms';

afterEach(() => applyLabelOverrides([]));

describe('firstGrapheme', () => {
  it('returns empty for blank input', () => {
    expect(firstGrapheme('')).toBe('');
    expect(firstGrapheme('   ')).toBe('');
  });

  it('returns a simple emoji intact', () => {
    expect(firstGrapheme('🚗')).toBe('🚗');
  });

  it('keeps complex ZWJ/flag/skin-tone emoji intact (Intl.Segmenter path)', () => {
    // Hermes and Node both ship Intl.Segmenter; the fallback would split
    // these, so this pins the segmenter path.
    for (const e of ['👨‍💻', '👩🏽‍🚀', '🏳️‍🌈', '🇺🇸']) {
      expect(firstGrapheme(e)).toBe(e);
    }
  });

  it('takes only the FIRST emoji when several are typed', () => {
    expect(firstGrapheme('🚗📦')).toBe('🚗');
    expect(firstGrapheme('👩🏽‍🚀🚗')).toBe('👩🏽‍🚀');
  });

  it('trims surrounding whitespace before extracting', () => {
    expect(firstGrapheme('  📦 ')).toBe('📦');
  });
});

describe('heading emoji overrides', () => {
  it('defaults when no override exists', () => {
    expect(headingEmoji('PLATFORM')).toBe(DEFAULT_HEADING_EMOJI.PLATFORM);
    expect(headingEmoji('TYPE')).toBe(DEFAULT_HEADING_EMOJI.TYPE);
  });

  it('applies a custom emoji + title from an override row', () => {
    applyLabelOverrides([{ kind: 'heading', key: 'PLATFORM', label: 'Gig App', emoji: '🛵' }]);
    expect(headingEmoji('PLATFORM')).toBe('🛵');
    expect(headingLabel('PLATFORM', 'Platform')).toBe('Gig App');
  });

  it('emoji-only row (empty label) keeps the default title', () => {
    applyLabelOverrides([{ kind: 'heading', key: 'TYPE', label: '', emoji: '📦' }]);
    expect(headingEmoji('TYPE')).toBe('📦');
    expect(headingLabel('TYPE', 'Type')).toBe('Type');
  });

  it('row without emoji leaves the default emoji', () => {
    applyLabelOverrides([{ kind: 'heading', key: 'TYPE', label: 'Order Type' }]);
    expect(headingEmoji('TYPE')).toBe(DEFAULT_HEADING_EMOJI.TYPE);
    expect(headingLabel('TYPE', 'Type')).toBe('Order Type');
  });

  it('clearing overrides restores both defaults', () => {
    applyLabelOverrides([{ kind: 'heading', key: 'PLATFORM', label: 'Gig App', emoji: '🛵' }]);
    applyLabelOverrides([]);
    expect(headingEmoji('PLATFORM')).toBe(DEFAULT_HEADING_EMOJI.PLATFORM);
    expect(headingLabel('PLATFORM', 'Platform')).toBe('Platform');
  });
});
