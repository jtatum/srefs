#!/usr/bin/env tsx

import { getAllSrefMetadata } from '../src/lib/sref-data';

interface TagStats {
  tag: string;
  count: number;
  srefs: string[]; // Array of sref IDs using this tag
}

async function analyzeTags() {
  console.log('Loading all srefs...');
  const srefs = await getAllSrefMetadata();
  console.log(`Found ${srefs.length} srefs\n`);

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
    .sort((a, b) => a.count - b.count); // Sort by count ascending (least used first)

  console.log('=== TAG USAGE ANALYSIS ===\n');
  
  console.log(`📊 Total unique tags: ${tagStats.length}`);
  console.log(`📈 Most used tag: "${tagStats[tagStats.length - 1].tag}" (${tagStats[tagStats.length - 1].count} times)`);
  console.log(`📉 Least used tags: ${tagStats.filter(t => t.count === 1).length} tags used only once\n`);

  // Show tags with low usage (1-3 uses)
  const lowUsageTags = tagStats.filter(stat => stat.count <= 3);
  if (lowUsageTags.length > 0) {
    console.log('🔍 LOW USAGE TAGS (≤3 uses):');
    console.log('─'.repeat(50));
    lowUsageTags.forEach(stat => {
      console.log(`• "${stat.tag}" (${stat.count} use${stat.count === 1 ? '' : 's'}): ${stat.srefs.join(', ')}`);
    });
    console.log('');
  }

  // Show complete tag statistics
  console.log('📋 ALL TAG STATISTICS (sorted by usage):');
  console.log('─'.repeat(50));
  tagStats.forEach(stat => {
    const percentage = ((stat.count / srefs.length) * 100).toFixed(1);
    console.log(`${stat.tag.padEnd(20)} │ ${stat.count.toString().padStart(3)} uses │ ${percentage.padStart(5)}% │ ${stat.srefs.join(', ')}`);
  });

  // Show usage distribution
  console.log('\n📈 USAGE DISTRIBUTION:');
  console.log('─'.repeat(30));
  const usageBuckets = new Map<number, number>();
  tagStats.forEach(stat => {
    usageBuckets.set(stat.count, (usageBuckets.get(stat.count) || 0) + 1);
  });

  Array.from(usageBuckets.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([usage, count]) => {
      console.log(`${usage} use${usage === 1 ? '' : 's'}: ${count} tag${count === 1 ? '' : 's'}`);
    });
}

analyzeTags().catch(console.error);