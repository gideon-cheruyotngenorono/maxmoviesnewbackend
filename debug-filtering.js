#!/usr/bin/env node

const apiClient = require('./utils/apiClient');

async function debugChicagoFire() {
  console.log('Debugging Chicago Fire filtering issue\n');
  
  // IDs from our previous test
  const testIds = [
    '5034101543105089528', // Chicago Fire S14
    '3885261425660547064', // Chicago P.D.
  ];

  for (const id of testIds) {
    console.log(`\n=== Testing ID: ${id} ===`);
    
    try {
      const response = await apiClient.get(`/info/${id}`);
      
      console.log('Response structure:');
      console.log(`  - Has results: ${!!response.results}`);
      console.log(`  - Has subject: ${!!response.results?.subject}`);
      
      if (response.results?.subject) {
        const subject = response.results.subject;
        console.log('\nSubject data:');
        console.log(`  - Title: ${subject.title || subject.name || 'N/A'}`);
        console.log(`  - Has cover: ${!!subject.cover}`);
        console.log(`  - Cover type: ${typeof subject.cover}`);
        if (subject.cover) {
          console.log(`  - Cover value: ${JSON.stringify(subject.cover).substring(0, 100)}`);
        }
        console.log(`  - Has thumb: ${!!subject.thumb}`);
        if (subject.thumb) {
          console.log(`  - Thumb value: ${subject.thumb.substring(0, 100)}`);
        }
        console.log(`  - Rating: ${subject.imdbRatingValue || 'N/A'}`);
        console.log(`  - Genre: ${subject.genre || 'N/A'}`);
        
        // Check if it would be filtered
        const wouldFilter = !subject.cover && !subject.thumb;
        console.log(`\n  ⚠️ Would be FILTERED OUT: ${wouldFilter ? 'YES' : 'NO'}`);
        
        if (wouldFilter) {
          console.log('  Reason: Missing both cover and thumb');
        }
      } else {
        console.log('\n❌ ERROR: No subject data in response');
        console.log('Full response:', JSON.stringify(response, null, 2).substring(0, 500));
      }
      
    } catch (error) {
      console.log(`❌ API Error: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log(`Data: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }
}

debugChicagoFire().catch(console.error);
