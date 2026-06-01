#!/usr/bin/env node

const apiClient = require('./utils/apiClient');
const { searchMovieBox } = require('./utils/movieBoxSearch');

async function debugEndpointFlow() {
  console.log('Debugging full endpoint flow\n');
  
  // Step 1: Get basic search results from Movie Box
  console.log('Step 1: Searching Movie Box for "chicago fire"...');
  const basicResults = await searchMovieBox('chicago fire');
  console.log(`Found ${basicResults.items.length} items\n`);
  
  // Show first 3 items
  basicResults.items.slice(0, 3).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title} (ID: ${item.subjectId})`);
  });
  
  console.log(`\n\nStep 2: Testing getInfo for each item...\n`);
  
  // Step 2: Test getInfo for each
  const getInfo = async (id) => {
    const metadata = await apiClient.get(`/info/${id}`);
    return metadata;
  };
  
  for (let i = 0; i < Math.min(3, basicResults.items.length); i++) {
    const item = basicResults.items[i];
    console.log(`Testing: ${item.title}`);
    
    try {
      const info = await getInfo(item.subjectId);
      
      if (info && info.results && info.results.subject) {
        const subject = info.results.subject;
        console.log(`  ✅ Got data`);
        console.log(`     - Has cover: ${!!subject.cover}`);
        console.log(`     - Has thumb: ${!!subject.thumb}`);
        console.log(`     - Would filter: ${!subject.cover && !subject.thumb ? 'YES' : 'NO'}`);
      } else {
        console.log(`  ❌ No subject data`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

debugEndpointFlow().catch(console.error);
