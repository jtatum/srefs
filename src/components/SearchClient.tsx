import { useState, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import type { SearchableItem } from '../lib/types';

interface SearchClientProps {
  items: SearchableItem[];
}

export default function SearchClient({ items }: SearchClientProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [results, setResults] = useState<SearchableItem[]>(items);

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
    let filtered = items;

    if (query) {
      const searchResults = fuse.search(query);
      filtered = searchResults.map(result => result.item);
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(item =>
        selectedTags.every(tag => item.tags.includes(tag))
      );
    }

    setResults(filtered);
  }, [query, selectedTags, items, fuse]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyClick = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(` --sref ${id}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div>
      <div className="space-y-4 mb-8">
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

      {results.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No matching srefs found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {results.map(item => (
            <article key={item.id} className="group relative bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
              <a href={item.path} className="block">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                        {item.id}
                      </code>
                      <button
                        onClick={(e) => handleCopyClick(e, item.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        title={`Copy --sref ${item.id}`}
                      >
                        {copiedId === item.id ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="inline-block px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}