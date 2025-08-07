import { useState, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import type { SearchableItem } from '../lib/types';

interface SearchProps {
  items: SearchableItem[];
  onResults: (results: SearchableItem[]) => void;
}

export default function Search({ items, onResults }: SearchProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach(item => {
      item.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [items]);

  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: ['title', 'description', 'tags', 'id'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [items]);

  useEffect(() => {
    let results = items;

    if (query) {
      const searchResults = fuse.search(query);
      results = searchResults.map(result => result.item);
    }

    if (selectedTags.length > 0) {
      results = results.filter(item =>
        selectedTags.every(tag => item.tags.includes(tag))
      );
    }

    onResults(results);
  }, [query, selectedTags, items, fuse, onResults]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search srefs by title, ID, or description..."
          className="w-full px-4 py-2 pr-10 text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {(query || selectedTags.length > 0) && (
        <button
          onClick={() => {
            setQuery('');
            setSelectedTags([]);
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}