const apiClient = require('../../utils/apiClient');
const { searchMovieBox, searchMovieBoxFull } = require('../../utils/movieBoxSearch');

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
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Query parameter is required'
      });
    }

    // Always fetch full metadata with real thumbnails from API
    // This ensures consistent behavior and proper thumbnails for all search results
    const getInfo = async (id) => {
      try {
        const metadata = await apiClient.get(`/info/${id}`);
        return metadata;
      } catch (err) {
        console.warn(`[API] Error fetching info for ID ${id}:`, err.message);
        return { id };
      }
    };

    const results = await searchMovieBoxFull(query, getInfo);

    return res.status(200).json({
      status: 200,
      success: true,
      creator: "GiftedTech",
      query: query,
      resultsCount: results.length,
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
