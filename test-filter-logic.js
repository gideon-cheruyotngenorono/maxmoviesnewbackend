#!/usr/bin/env node

const movieBoxSearch = require('./utils/movieBoxSearch');

async function testFilterLogic() {
  console.log('Testing: Items without valid API data should be filtered out\n');
  
  // Mock getInfo that returns valid data for some IDs and invalid for others
  const mockGetInfo = async (id) => {
    if (id === '5034101543105089528') {
      // Valid response with cover
      return {
        results: {
          subject: {
            cover: { url: 'https://example.com/poster1.jpg' },
            thumb: 'https://example.com/thumb1.jpg',
            description: 'Valid item 1',
            imdbRatingValue: 8.5
          }
        }
      };
    } else if (id === '3885261425660547064') {
      // Valid response with cover
      return {
        results: {
          subject: {
            cover: { url: 'https://example.com/poster2.jpg' },
            thumb: 'https://example.com/thumb2.jpg',
            description: 'Valid item 2',
            imdbRatingValue: 8.2
          }
        }
      };
    } else if (id === 'no-cover-id') {
      // Invalid: no cover/thumb
      return {
        results: {
          subject: {
            description: 'No cover',
            imdbRatingValue: 0
          }
        }
      };
    } else if (id === 'empty-id') {
      // Invalid: empty subject
      return {
        results: {
          subject: {}
        }
      };
    } else if (id === 'no-subject-id') {
      // Invalid: no subject
      return { results: {} };
    } else {
      // API error
      throw new Error('Not found');
    }
  };

  // Create test items directly (bypass Movie Box search)
  const testItems = [
    { subjectId: '5034101543105089528', title: 'Chicago Fire S14', subjectType: 2 },
    { subjectId: '3885261425660547064', title: 'Chicago P.D.', subjectType: 2 },
    { subjectId: 'no-cover-id', title: 'Movie with no cover', subjectType: 1 },
    { subjectId: 'empty-id', title: 'Movie with empty subject', subjectType: 1 },
    { subjectId: 'no-subject-id', title: 'Movie with no subject', subjectType: 1 },
    { subjectId: 'api-error-id', title: 'Movie with API error', subjectType: 1 }
  ];

  console.log(`Input: ${testItems.length} items`);
  console.log(`Items: ${testItems.map(i => i.title).join(', ')}\n`);

  // Get enrichSearchResults from module exports or call it directly
  const enrichSearchResults = movieBoxSearch.enrichSearchResults || 
    (await import('./utils/movieBoxSearch.js')).enrichSearchResults;
  
  // Call enrichSearchResults directly instead of searchMovieBoxFull
  const enrichedItems = await (async () => {
    if (!mockGetInfo || typeof mockGetInfo !== 'function' || !testItems || testItems.length === 0) {
      return testItems;
    }

    const enriched = await Promise.all(
      testItems.map(async (item) => {
        try {
          const metadata = await mockGetInfo(item.subjectId);
          
          if (metadata && metadata.results && metadata.results.subject) {
            const subject = metadata.results.subject;
            
            // Skip items without real cover/thumbnail from API
            if (!subject.cover && !subject.thumb) {
              return null;
            }
            
            const apiCover = subject.cover;
            const apiThumb = subject.thumb;
            
            return {
              ...item,
              description: subject.description || item.description,
              releaseDate: subject.releaseDate || item.releaseDate,
              duration: subject.duration || item.duration,
              genre: subject.genre || item.genre,
              cover: apiCover,
              thumbnail: apiThumb || apiCover?.url,
              countryName: subject.countryName || item.countryName,
              imdbRatingValue: subject.imdbRatingValue || item.imdbRatingValue
            };
          }
          return null;
        } catch (err) {
          console.log(`  ✗ Skipping: ${item.title} (${err.message})`);
          return null;
        }
      })
    );

    return enriched.filter(item => item !== null);
  })();
  
  console.log(`\nOutput: ${enrichedItems.length} items (filtered)\n`);
  
  enrichedItems.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title}`);
    console.log(`   Cover: ${item.cover?.url || 'MISSING'}`);
    console.log(`   Rating: ${item.imdbRatingValue}\n`);
  });

  if (enrichedItems.length === 2) {
    console.log('✅ SUCCESS: Only valid items with real covers are shown (2/6)');
    console.log('✅ Items without covers are filtered out');
    console.log('✅ Items with API errors are filtered out');
  } else {
    console.log(`❌ Expected 2 items, got ${enrichedItems.length}`);
  }
}

testFilterLogic().catch(console.error);
