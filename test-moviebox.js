const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function testMovieBoxSearch() {
  try {
    console.log('Fetching Movie Box search results...');
    const response = await axios.get('https://movie-box.co/web/searchResult?keyword=chicago%20fire', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response length:', response.data.length);

    // Save HTML to file for inspection
    fs.writeFileSync('moviebox_response.html', response.data);
    console.log('HTML saved to moviebox_response.html');

    // Parse with cheerio
    const $ = cheerio.load(response.data);

    // Check different selectors
    console.log('\n=== HTML Analysis ===');
    console.log('Total a tags:', $('a').length);
    console.log('Links with /detail/:', $('a[href*="/detail/"]').length);
    console.log('Links with id=:', $('a[href*="id="]').length);
    
    // Look for divs or other containers that might have links
    console.log('Total divs:', $('div').length);
    console.log('Total article tags:', $('article').length);
    console.log('Total section tags:', $('section').length);

    // Check for script tags with data
    const scripts = $('script');
    console.log('\nTotal script tags:', scripts.length);
    
    // Check if there's JSON data in script tags
    scripts.each((i, el) => {
      const content = $(el).html();
      if (content && (content.includes('detail') || content.includes('search'))) {
        console.log(`Script ${i} contains relevant data, length: ${content.length}`);
      }
    });

    // Try to find any links
    console.log('\n=== Sample Links ===');
    const links = [];
    $('a').each((i, el) => {
      if (i < 10) {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href) {
          links.push({ href, text: text.substring(0, 50) });
        }
      }
    });
    console.log(JSON.stringify(links, null, 2));

    // Try to find detail links specifically
    console.log('\n=== Detail Links ===');
    const detailLinks = [];
    $('a[href*="/detail/"]').each((i, el) => {
      if (i < 5) {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        detailLinks.push({ href, text: text.substring(0, 50) });
      }
    });
    console.log(JSON.stringify(detailLinks, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testMovieBoxSearch();
