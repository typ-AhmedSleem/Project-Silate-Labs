/**
 * PhraseTokenizer
 * Converts raw user phrases into normalized, tokenized words for the motion repository.
 */
export class PhraseTokenizer {
  /**
   * Tokenizes an input string into an array of clean lowercase words.
   * Handles punctuation stripping, lowercasing, whitespace trimming, and filtering empty tokens.
   */
  public tokenize(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    return text
      .toLowerCase()
      // Replace punctuation and special characters with space
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
      // Split on one or more whitespace characters
      .split(/\s+/)
      // Filter out empty strings
      .filter((token) => token.length > 0);
  }
}
