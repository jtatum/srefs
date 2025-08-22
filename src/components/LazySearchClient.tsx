import { useState, useEffect, lazy, Suspense } from 'react';
import type { SearchableItem } from '../lib/types';

const SearchClient = lazy(() => import('./SearchClient'));

interface LazySearchClientProps {
  items: SearchableItem[];
}

function SearchFallback() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="animate-pulse">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LazySearchClient({ items }: LazySearchClientProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Load search component when user scrolls to search section or after 1 second
    const timer = setTimeout(() => setShouldLoad(true), 1000);
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    const exploreElement = document.getElementById('explore');
    if (exploreElement) {
      observer.observe(exploreElement);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (!shouldLoad) {
    return <SearchFallback />;
  }

  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchClient items={items} />
    </Suspense>
  );
}