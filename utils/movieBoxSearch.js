const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Movie Box Search Helper
 * 
 * This module provides functionality to search Movie Box and extract content IDs.
 * It handles HTML parsing, ID extraction, and deduplication.
 */

// User-Agent header to avoid being blocked by the server
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

// Create axios instance for Movie Box requests
const movieBoxClient = axios.create({
  baseURL: 'https://movie-box.co',
  timeout: 10000,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
});

/**
 * Search Movie Box for a query and extract content IDs
 * 
 * @param {string} query - Search query (e.g., "chicago fire")
 * @returns {Promise<Array>} Array of objects with at least { id, title?, poster?, type? }
 * @throws {Error} If the request fails
 */
async function searchMovieBox(query) {
  try {
    // Step 1: Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return [];
    }

    const searchQuery = encodeURIComponent(query.trim());

    // Step 2: Build the search URL
    // Movie Box search endpoint format: /web/searchResult?keyword=<search_term>
    const searchUrl = `/web/searchResult?keyword=${searchQuery}`;

    console.log(`[MovieBox] Searching for: "${query}"`);

    // Step 3: Fetch the HTML page from Movie Box
    const response = await movieBoxClient.get(searchUrl);
    const html = response.data;

    // Step 4: Parse HTML with cheerio
    const $ = cheerio.load(html);

    // Step 5: Find all detail links and extract IDs
    const results = [];
    const seenIds = new Set(); // To track and remove duplicates

    // Look for links that contain /detail/ in their href
    $('a[href*="/detail/"]').each((index, element) => {
      try {
        const href = $(element).attr('href');
        
        if (!href) return; // Skip if no href

        // Extract ID using regex: /id=(\d+)/
        const idMatch = href.match(/id=(\d+)/);
        
        if (!idMatch || !idMatch[1]) {
          return; // Skip if ID not found
        }

        const id = idMatch[1];

        // Skip if we've already seen this ID (deduplication)
        if (seenIds.has(id)) {
          return;
        }

        seenIds.add(id);

        // Step 6: Extract optional metadata
        const result = {
          id: id
        };

        // Try to extract title from link text or data attributes
        const linkText = $(element).text().trim();
        if (linkText && linkText.length > 0 && linkText.length < 200) {
          result.title = linkText;
        }

        // Try to extract poster from nearby image or data attributes
        const posterAttr = $(element).data('poster') || 
                           $(element).find('img').attr('src') ||
                           $(element).find('img').attr('data-src');
        if (posterAttr) {
          result.poster = posterAttr;
        }

        // Try to extract type from URL or data attributes
        const typeMatch = href.match(/type=([^&]+)/);
        if (typeMatch && typeMatch[1]) {
          result.type = decodeURIComponent(typeMatch[1]);
        }

        results.push(result);
      } catch (err) {
        // Log but continue processing other links
        console.error(`[MovieBox] Error parsing link:`, err.message);
      }
    });

    console.log(`[MovieBox] Found ${results.length} unique results for query: "${query}"`);

    return results;
  } catch (error) {
    console.error(`[MovieBox] Search error for query "${query}":`, error.message);
    
    // Return empty array on error instead of throwing
    // This ensures the API endpoint doesn't crash
    if (error.response?.status === 404) {
      console.log(`[MovieBox] No results found for: "${query}"`);
      return [];
    }
    
    throw error;
  }
}

/**
 * Search Movie Box and optionally get full metadata for each result
 * 
 * This function first searches Movie Box to get IDs, then optionally
 * fetches full metadata for each result using the provided getInfo function.
 * 
 * @param {string} query - Search query
 * @param {Function} getInfo - Optional function to fetch full metadata: async (id) => metadata
 * @returns {Promise<Array>} Array of search results with optional full metadata
 */
async function searchMovieBoxFull(query, getInfo) {
  try {
    // First, get the basic search results with IDs
    const basicResults = await searchMovieBox(query);

    // If no getInfo function provided or no results, return basic results
    if (!getInfo || typeof getInfo !== 'function' || basicResults.length === 0) {
      return basicResults;
    }

    // Fetch full metadata for each result in parallel
    const fullResults = await Promise.all(
      basicResults.map(async (result) => {
        try {
          const metadata = await getInfo(result.id);
          // Merge basic result with full metadata
          return {
            ...result,
            ...metadata
          };
        } catch (err) {
          // If metadata fetch fails, return just the basic result
          console.error(`[MovieBox] Error fetching metadata for ID ${result.id}:`, err.message);
          return result;
        }
      })
    );

    return fullResults;
  } catch (error) {
    console.error(`[MovieBox] Full search error for query "${query}":`, error.message);
    throw error;
  }
}

module.exports = {
  searchMovieBox,
  searchMovieBoxFull
};
