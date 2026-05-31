const apiClient = require('./utils/apiClient');
const { searchMovieBoxFull } = require('./utils/movieBoxSearch');

async function test() {
  const getInfo = async (id) => {
    try {
      const metadata = await apiClient.get(`/info/${id}`);
      return metadata;
    } catch (err) {
      console.warn(`Error fetching info for ID ${id}:`, err.message);
      return { id };
    }
  };

  console.log('=== Testing Search with Real Thumbnails ===\n');
  const results = await searchMovieBoxFull('chicago fire', getInfo);
  
  console.log(`\nTotal Results: ${results.items.length}`);
  console.log('\nFirst 3 Results:\n');
  
  results.items.slice(0, 3).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.title}`);
    console.log(`   ID: ${item.subjectId}`);
    console.log(`   Type: ${['?', 'Movie', 'Series', 'Music'][item.subjectType]}`);
    console.log(`   Cover URL: ${item.cover?.url ? item.cover.url.substring(0, 80) + '...' : 'N/A'}`);
    console.log(`   Thumbnail: ${item.thumbnail ? item.thumbnail.substring(0, 80) + '...' : 'N/A'}`);
    console.log(`   Genre: ${item.genre || 'N/A'}`);
    console.log(`   Rating: ${item.imdbRatingValue || 'N/A'}`);
    console.log('');
  });
}

test().catch(console.error);
