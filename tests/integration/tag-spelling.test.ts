import { describe, it, expect } from 'vitest';
import { getAllSrefMetadata } from '../../src/lib/sref-data.js';
import { spellCheckDocument } from 'cspell-lib';

describe('Tag and Title Spelling Validation', () => {
  // Shared custom words for both tags and titles
  const customWords = [
    'sref', 'midjourney', '3d', '1960s', '1980s', '1910s', 
    'duotone', 'monochrome', 'cyberpunk', 'steampunk',
    'pinterest', 'instagram', 'artstation', 'anime', 'manga',
    'vaporwave', 'synthwave', 'retrowave', 'kawaii', 'chibi',
    'cuphead', 'tintin'
  ];

  it('should detect misspelled tags using cspell', async () => {
    const allSrefs = await getAllSrefMetadata();
    const misspelledTags: Array<{tag: string, srefIds: string[], suggestions?: string[]}> = [];
    
    for (const sref of allSrefs) {
      for (const tag of sref.tags) {
        // Use cspell to check the tag with custom words to ignore
        const result = await spellCheckDocument(
          { uri: 'text.txt', text: tag, languageId: 'plaintext', locale: 'en' },
          { generateSuggestions: true, noConfigSearch: true },
          { words: customWords, suggestionsTimeout: 1000 }
        );
        
        if (result.issues.length > 0) {
          const existing = misspelledTags.find(m => m.tag === tag);
          if (existing) {
            existing.srefIds.push(sref.id);
          } else {
            const suggestions = result.issues[0].suggestions || [];
            misspelledTags.push({
              tag,
              srefIds: [sref.id],
              suggestions: suggestions.slice(0, 3) // Top 3 suggestions
            });
          }
        }
      }
    }

    // If misspelled tags are found, provide detailed information
    if (misspelledTags.length > 0) {
      const errorMessage = misspelledTags.map(m => {
        const suggestionText = m.suggestions && m.suggestions.length > 0 
          ? ` (suggestions: ${m.suggestions.join(', ')})` 
          : '';
        return `"${m.tag}" in srefs: ${m.srefIds.join(', ')}${suggestionText}`;
      }).join('\n');
      
      throw new Error(`Found potentially misspelled tags:\n${errorMessage}`);
    }
  });

  it('should detect misspelled titles using cspell', async () => {
    const allSrefs = await getAllSrefMetadata();
    const misspelledTitles: Array<{title: string, srefId: string, suggestions?: string[]}> = [];
    
    for (const sref of allSrefs) {
      if (sref.title) {
        // Use cspell to check the title with custom words to ignore
        const result = await spellCheckDocument(
          { uri: 'text.txt', text: sref.title, languageId: 'plaintext', locale: 'en' },
          { generateSuggestions: true, noConfigSearch: true },
          { words: customWords, suggestionsTimeout: 1000 }
        );
        
        if (result.issues.length > 0) {
          // Report each misspelled word in the title
          for (const issue of result.issues) {
            const suggestions = issue.suggestions || [];
            misspelledTitles.push({
              title: `"${sref.title}" (word: "${issue.text}")`,
              srefId: sref.id,
              suggestions: suggestions.slice(0, 3) // Top 3 suggestions
            });
          }
        }
      }
    }

    // If misspelled titles are found, provide detailed information
    if (misspelledTitles.length > 0) {
      const errorMessage = misspelledTitles.map(m => {
        const suggestionText = m.suggestions && m.suggestions.length > 0 
          ? ` (suggestions: ${m.suggestions.join(', ')})` 
          : '';
        return `${m.title} in sref: ${m.srefId}${suggestionText}`;
      }).join('\n');
      
      throw new Error(`Found potentially misspelled titles:\n${errorMessage}`);
    }
  });

  it('should detect the psychadelic misspelling', async () => {
    // Test that our spell checker would catch the old misspelling
    const misspelledWord = 'psychadelic';
    const result = await spellCheckDocument(
      { uri: 'text.txt', text: misspelledWord, languageId: 'plaintext', locale: 'en' },
      { generateSuggestions: true, noConfigSearch: true },
      { suggestionsTimeout: 1000 }
    );
    
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].text).toBe('psychadelic');
    
    // Check that it suggests the correct spelling
    const suggestions = result.issues[0].suggestions || [];
    expect(suggestions).toContain('psychedelic');
  });

  it('should not flag correctly spelled common art terms', async () => {
    const commonArtTerms = [
      'illustration', 'painting', 'abstract', 'surreal', 
      'vintage', 'retro', 'colorful', 'pastel'
    ];
    
    for (const term of commonArtTerms) {
      const result = await spellCheckDocument(
        { uri: 'text.txt', text: term, languageId: 'plaintext', locale: 'en' },
        { generateSuggestions: false, noConfigSearch: true },
        { suggestionsTimeout: 1000 }
      );
      expect(result.issues.length).toBe(0);
    }
  });

  it('should provide suggestions for misspelled words', async () => {
    const testMisspellings = [
      { word: 'psychadelic', expectedSuggestion: 'psychedelic' },
      { word: 'irridescent', expectedSuggestion: 'iridescent' },
      { word: 'seperate', expectedSuggestion: 'separate' }
    ];
    
    for (const test of testMisspellings) {
      const result = await spellCheckDocument(
        { uri: 'text.txt', text: test.word, languageId: 'plaintext', locale: 'en' },
        { generateSuggestions: true, noConfigSearch: true },
        { suggestionsTimeout: 1000 }
      );
      
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].text).toBe(test.word);
      
      const suggestions = result.issues[0].suggestions || [];
      expect(suggestions).toContain(test.expectedSuggestion);
    }
  });
});