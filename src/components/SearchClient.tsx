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
    <div className="space-y-8">
      {/* Enhanced Search Interface */}
      <div className="relative max-w-2xl mx-auto">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
          <div className="relative glass rounded-xl p-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search srefs by title, ID, or description..."
              className="w-full px-6 py-4 bg-white/80 text-gray-900 placeholder-gray-600 text-lg rounded-lg focus:outline-none focus:bg-white border-0"
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg shadow-lg">
              <svg
                className="w-5 h-5 text-white"
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
          </div>
        </div>
      </div>

      {/* Enhanced Tag Filters */}
      <div className="space-y-6">{allTags.length > 0 && (
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Filter by Style</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`relative px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 transform hover:scale-105 ${
                  selectedTags.includes(tag)
                    ? 'text-white shadow-lg'
                    : 'text-gray-800 bg-white/90 border border-gray-200 hover:shadow-md hover:bg-white'
                }`}
                style={{
                  background: selectedTags.includes(tag) 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : undefined
                }}
              >
                <span className="relative z-10">{tag}</span>
                {selectedTags.includes(tag) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-md"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
        
        {(query || selectedTags.length > 0) && (
          <div className="text-center">
            <button
              onClick={() => {
                setQuery('');
                setSelectedTags([]);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white/90 border border-gray-300 rounded-full hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47.927-6.03 2.438-.356-.26-.618-.597-.76-1.01A9.963 9.963 0 0112 15a9.963 9.963 0 006.79 1.428c-.142.413-.404.75-.76 1.01z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No matching srefs found</h3>
            <p className="text-gray-500">Try adjusting your search terms or filters</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {results.map(item => (
            <article key={item.id} className="group relative">
              {/* Card Glow Effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              
              <div className="relative glass rounded-xl overflow-hidden border border-white/20 group-hover:border-white/40 transition-all duration-300">
                <a href={item.path} className="block">
                  <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 relative">
                    <img
                      src={item.coverImageUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                    />
                    
                    {/* Image Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Floating Copy Button */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                      <button
                        onClick={(e) => handleCopyClick(e, item.id)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200"
                        title={`Copy --sref ${item.id}`}
                      >
                        {copiedId === item.id ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-white/95">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors duration-200 leading-tight">
                        {item.title}
                      </h3>
                      <div className="flex-shrink-0">
                        <code className="text-xs font-mono bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-full border border-indigo-200">
                          {item.id}
                        </code>
                      </div>
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-slate-700 mb-4 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span 
                          key={tag} 
                          className="inline-block px-3 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-full hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all duration-200 cursor-pointer"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="inline-block px-3 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-300 rounded-full">
                          +{item.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}