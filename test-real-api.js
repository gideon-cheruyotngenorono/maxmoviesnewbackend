#!/usr/bin/env node

const apiClient = require('./utils/apiClient');
const { searchMovieBoxFull } = require('./utils/movieBoxSearch');

async function testRealAPI() {
  console.log('Testing search with real API enrichment\n');
  
  const getInfo = async (id) => {
    return await apiClient.get(`/info/${id}`);
  };
  
  const results = await searchMovieBoxFull('chicago fire', getInfo);
  
  console.log(`Total results: ${results.items.length}\n`);
  
  results.items.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title}`);
    console.log(`   Type: ${['?', 'Movie', 'Series', 'Music'][item.subjectType]}`);
    console.log(`   Cover: ${item.cover?.url ? '✓ ' + item.cover.url.substring(0, 60) + '...' : 'N/A'}`);
    console.log(`   Rating: ${item.imdbRatingValue || 'N/A'}\n`);
  });
}

testRealAPI().catch(console.error);
