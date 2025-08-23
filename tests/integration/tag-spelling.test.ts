import { describe, it, expect } from 'vitest';
import { getAllSrefMetadata } from '../../src/lib/sref-data.js';
import * as spellchecker from 'spellchecker';

describe('Tag Spelling Validation', () => {
  it('should detect misspelled tags using spellchecker', async () => {
    const allSrefs = await getAllSrefMetadata();
    const misspelledTags: Array<{tag: string, srefIds: string[], suggestions?: string[]}> = [];
    
    for (const sref of allSrefs) {
      for (const tag of sref.tags) {
        // Skip common art/technical terms that might not be in dictionary
        const skipWords = [
          'sref', 'midjourney', '3d', '1960s', '1980s', '1910s', 
          'duotone', 'monochrome', 'cyberpunk', 'steampunk',
          'pinterest', 'instagram', 'artstation'
        ];
        
        if (skipWords.includes(tag.toLowerCase())) {
          continue;
        }
        
        // Check if the tag is misspelled
        if (spellchecker.isMisspelled(tag)) {
          const existing = misspelledTags.find(m => m.tag === tag);
          if (existing) {
            existing.srefIds.push(sref.id);
          } else {
            const suggestions = spellchecker.getCorrectionsForMisspelling(tag);
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

  it('should detect the psychadelic misspelling', () => {
    // Test that our spell checker would catch the old misspelling
    const misspelledWord = 'psychadelic';
    const isMisspelled = spellchecker.isMisspelled(misspelledWord);
    
    expect(isMisspelled).toBe(true);
    
    // Check that it suggests the correct spelling
    const suggestions = spellchecker.getCorrectionsForMisspelling(misspelledWord);
    expect(suggestions).toContain('psychedelic');
  });

  it('should not flag correctly spelled common art terms', () => {
    const commonArtTerms = [
      'illustration', 'painting', 'abstract', 'surreal', 
      'vintage', 'retro', 'colorful', 'pastel'
    ];
    
    for (const term of commonArtTerms) {
      expect(spellchecker.isMisspelled(term)).toBe(false);
    }
  });

  it('should provide suggestions for misspelled words', () => {
    const testMisspellings = [
      { word: 'psychadelic', expectedSuggestion: 'psychedelic' },
      { word: 'irridescent', expectedSuggestion: 'iridescent' },
      { word: 'seperate', expectedSuggestion: 'separate' }
    ];
    
    for (const test of testMisspellings) {
      expect(spellchecker.isMisspelled(test.word)).toBe(true);
      
      const suggestions = spellchecker.getCorrectionsForMisspelling(test.word);
      expect(suggestions).toContain(test.expectedSuggestion);
    }
  });
});