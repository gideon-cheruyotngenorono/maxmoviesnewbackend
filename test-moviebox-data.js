const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeMovieBoxData() {
  try {
    console.log('Fetching Movie Box search results...');
    const response = await axios.get('https://movie-box.co/web/searchResult?keyword=chicago%20fire', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const scripts = $('script');

    console.log(`\n=== Script Tags Analysis ===`);
    scripts.each((i, el) => {
      const content = $(el).html();
      if (!content) return;

      if (content.includes('searchResult') || content.includes('movie') || content.includes('"id"')) {
        console.log(`\n--- Script ${i} (${content.length} chars) ---`);
        const preview = content.substring(0, 500);
        console.log(preview);
        
        // Try to extract JSON
        try {
          if (content.includes('window.__NUXT_DATA__')) {
            console.log('[Script contains NUXT_DATA]');
          }
          if (content.includes('{') && content.includes('}')) {
            const jsonMatch = content.match(/\{[^{}]*"id"[^{}]*\}/);
            if (jsonMatch) {
              console.log('[Found potential JSON with id]:', jsonMatch[0].substring(0, 100));
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Also check if links have data attributes
    console.log(`\n=== Link Data Attributes ===`);
    const links = $('a[href*="/detail/"]');
    if (links.length > 0) {
      const firstLink = links.eq(0);
      console.log('First link HTML:', firstLink.html());
      console.log('Link attributes:', firstLink.attr());
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeMovieBoxData();
