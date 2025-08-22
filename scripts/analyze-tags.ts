#!/usr/bin/env tsx

import { getAllSrefMetadata } from '../src/lib/sref-data';
import type { SrefMetadata } from '../src/lib/types';

export interface TagStats {
  tag: string;
  count: number;
  srefs: string[]; // Array of sref IDs using this tag
}

export interface TagAnalysisResult {
  totalTags: number;
  mostUsedTag: TagStats;
  singleUseTags: number;
  lowUsageTags: TagStats[];
  allTagStats: TagStats[];
  usageBuckets: Map<number, number>;
}

const sortByCountAscending = (a: TagStats, b: TagStats) => a.count - b.count;

export function analyzeTagsFromSrefs(srefs: SrefMetadata[]): TagAnalysisResult {
  // Collect all tags and their usage
  const tagMap = new Map<string, { count: number; srefs: string[] }>();
  
  srefs.forEach(sref => {
    sref.tags.forEach(tag => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { count: 0, srefs: [] });
      }
      const tagData = tagMap.get(tag)!;
      tagData.count++;
      tagData.srefs.push(sref.id);
    });
  });

  // Convert to array and sort by count
  const tagStats: TagStats[] = Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      count: data.count,
      srefs: data.srefs
    }))
    .sort(sortByCountAscending); // Sort by count ascending (least used first)

  // Calculate usage buckets
  const usageBuckets = new Map<number, number>();
  tagStats.forEach(stat => {
    usageBuckets.set(stat.count, (usageBuckets.get(stat.count) || 0) + 1);
  });

  return {
    totalTags: tagStats.length,
    mostUsedTag: tagStats[tagStats.length - 1] || { tag: '', count: 0, srefs: [] },
    singleUseTags: tagStats.filter(t => t.count === 1).length,
    lowUsageTags: tagStats.filter(stat => stat.count <= 3),
    allTagStats: tagStats,
    usageBuckets
  };
}

export function printTagAnalysis(result: TagAnalysisResult, totalSrefs: number): void {
  console.log('=== TAG USAGE ANALYSIS ===\n');
  
  console.log(`📊 Total unique tags: ${result.totalTags}`);
  if (result.totalTags > 0) {
    console.log(`📈 Most used tag: "${result.mostUsedTag.tag}" (${result.mostUsedTag.count} times)`);
    console.log(`📉 Least used tags: ${result.singleUseTags} tags used only once\n`);
  }

  // Show tags with low usage (1-3 uses)
  if (result.lowUsageTags.length > 0) {
    console.log('🔍 LOW USAGE TAGS (≤3 uses):');
    console.log('─'.repeat(50));
    result.lowUsageTags.forEach(stat => {
      console.log(`• "${stat.tag}" (${stat.count} use${stat.count === 1 ? '' : 's'}): ${stat.srefs.join(', ')}`);
    });
    console.log('');
  }

  // Show complete tag statistics
  console.log('📋 ALL TAG STATISTICS (sorted by usage):');
  console.log('─'.repeat(50));
  result.allTagStats.forEach(stat => {
    const percentage = totalSrefs > 0 ? ((stat.count / totalSrefs) * 100).toFixed(1) : '0.0';
    console.log(`${stat.tag.padEnd(20)} │ ${stat.count.toString().padStart(3)} uses │ ${percentage.padStart(5)}% │ ${stat.srefs.join(', ')}`);
  });

  // Show usage distribution
  console.log('\n📈 USAGE DISTRIBUTION:');
  console.log('─'.repeat(30));
  Array.from(result.usageBuckets.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([usage, count]) => {
      console.log(`${usage} use${usage === 1 ? '' : 's'}: ${count} tag${count === 1 ? '' : 's'}`);
    });
}

export async function analyzeTags(): Promise<void> {
  console.log('Loading all srefs...');
  try {
    const srefs = await getAllSrefMetadata();
    console.log(`Found ${srefs.length} srefs\n`);

    const result = analyzeTagsFromSrefs(srefs);
    printTagAnalysis(result, srefs.length);
  } catch (error) {
    console.error('Failed to load sref data:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeTags().catch(console.error);
}