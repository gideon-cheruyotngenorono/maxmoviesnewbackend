const apiClient = require('../utils/apiClient');
const { searchMovieBox, searchMovieBoxFull } = require('../utils/movieBoxSearch');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 405,
      success: false,
      message: 'Method not allowed. Use GET.'
    });
  }

  try {
    const { q, query, full } = req.query;
    
    // Support both 'q' and 'query' parameters for flexibility
    const searchQuery = q || query;
    
    if (!searchQuery) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Search query parameter is required (use ?q=<query> or ?query=<query>)'
      });
    }

    // Step 1: Search Movie Box to discover content IDs
    // Create a wrapper for getInfo that uses the existing apiClient
    const getInfo = async (id) => {
      try {
        const metadata = await apiClient.get(`/info/${id}`);
        return metadata;
      } catch (err) {
        console.warn(`[API] Error fetching info for ID ${id}:`, err.message);
        // Return minimal data if full info fetch fails
        return { id };
      }
    };

    // Always enrich search results with real metadata from the API
    // This ensures we get real thumbnails instead of Movie Box placeholders
    const results = await searchMovieBoxFull(searchQuery, getInfo);

    // Step 3: Return the clean JSON response
    return res.status(200).json({
      status: 200,
      success: true,
      creator: "GiftedTech",
      results: results
    });
    
  } catch (error) {
    console.error('[API] Search error:', error.message);
    
    return res.status(error.status || 500).json({
      status: error.status || 500,
      success: false,
      message: error.message || 'Internal server error',
      results: []
    });
  }
};
