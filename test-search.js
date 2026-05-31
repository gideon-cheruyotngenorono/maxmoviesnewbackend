#!/usr/bin/env node

// Simple test to verify search endpoint logic
const movieBoxSearch = require('./utils/movieBoxSearch');

async function runTest() {
  console.log('=== Testing MovieBox Search ===\n');
  
  try {
    // Test without enrichment first (basic search)
    console.log('1. Testing basic searchMovieBox...');
    const basicResults = await movieBoxSearch.searchMovieBox('chicago fire');
    console.log(`   Found ${basicResults.items?.length || 0} items\n`);
    
    if (basicResults.items && basicResults.items.length > 0) {
      console.log('   First item (basic):');
      const item = basicResults.items[0];
      console.log(`   - Title: ${item.title}`);
      console.log(`   - SubjectID: ${item.subjectId}`);
      console.log(`   - Type: ${item.subjectType}`);
      console.log(`   - Cover URL: ${item.cover?.url ? item.cover.url.substring(0, 60) + '...' : 'N/A'}\n`);
    }
    
    // Test with enrichment (full search with mock getInfo)
    console.log('2. Testing searchMovieBoxFull with getInfo...');
    
    const mockGetInfo = async (id) => {
      // Return a mock metadata response
      return {
        results: {
          subject: {
            cover: { url: `https://example.com/posters/${id}.jpg` },
            thumb: `https://example.com/thumbs/${id}.jpg`,
            description: 'Mock description',
            releaseDate: '2024-01-01',
            genre: 'Action,Drama',
            imdbRatingValue: 8.5
          }
        }
      };
    };
    
    const fullResults = await movieBoxSearch.searchMovieBoxFull('chicago fire', mockGetInfo);
    console.log(`   Found ${fullResults.items?.length || 0} items\n`);
    
    if (fullResults.items && fullResults.items.length > 0) {
      console.log('   First item (enriched):');
      const item = fullResults.items[0];
      console.log(`   - Title: ${item.title}`);
      console.log(`   - SubjectID: ${item.subjectId}`);
      console.log(`   - Type: ${item.subjectType}`);
      console.log(`   - Cover URL: ${item.cover?.url ? item.cover.url.substring(0, 60) + '...' : 'N/A'}`);
      console.log(`   - Thumbnail: ${item.thumbnail ? item.thumbnail.substring(0, 60) + '...' : 'N/A'}`);
      console.log(`   - IMDB Rating: ${item.imdbRatingValue || 'N/A'}\n`);
    }
    
    console.log('✓ Test completed successfully');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();
