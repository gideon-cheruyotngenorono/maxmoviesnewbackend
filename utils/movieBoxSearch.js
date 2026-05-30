const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Movie Box Search Helper
 * 
 * This module provides functionality to search Movie Box and extract content IDs.
 * It handles HTML parsing, ID extraction, and deduplication.
 */

// User-Agent header to avoid being blocked by the server
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Create axios instance for Movie Box requests
const movieBoxClient = axios.create({
  baseURL: 'https://movie-box.co',
  timeout: 15000,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
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
    console.log(`[MovieBox] Request URL: ${searchUrl}`);

    // Step 3: Fetch the HTML page from Movie Box
    const response = await movieBoxClient.get(searchUrl);
    const html = response.data;

    console.log(`[MovieBox] Response size: ${html.length} bytes`);
    console.log(`[MovieBox] Response status: ${response.status}`);

    // Step 4: Parse HTML with cheerio
    const $ = cheerio.load(html);

    // Step 5: Find all detail links and extract information
    const results = [];
    const seenSlugs = new Set(); // To track and remove duplicates

    // Look for links that contain /detail/ in their href
    let detailLinksFound = 0;
    
    $('a').each((index, element) => {
      try {
        const href = $(element).attr('href');
        
        if (!href) return; // Skip if no href

        // Check if this is a detail link
        if (href.includes('/detail/')) {
          detailLinksFound++;
          
          // Extract slug from URL: /detail/chicago-fire-etzlmHMeSZ5
          const slugMatch = href.match(/\/detail\/([^/?]+)/);
          
          if (!slugMatch || !slugMatch[1]) {
            console.log(`[MovieBox] Detail link found but no slug: ${href}`);
            return; // Skip if slug not found
          }

          const slug = slugMatch[1];

          // Skip if we've already seen this slug (deduplication)
          if (seenSlugs.has(slug)) {
            return;
          }

          seenSlugs.add(slug);

          // Step 6: Extract metadata
          const result = {
            // Use slug as identifier since Movie Box doesn't expose numeric ID in HTML
            // The slug contains a unique code (e.g., etzlmHMeSZ5)
            id: slug,
            slug: slug
          };

          // Try to extract title from link text and clean it
          let linkText = $(element).text().trim();
          if (linkText && linkText.length > 0 && linkText.length < 500) {
            // Clean up title: remove rating numbers and "Watch now" text
            // Example: "8.0Chicago Fire S14Watch now" -> "Chicago Fire S14"
            linkText = linkText
              .replace(/^\d+\.?\d*/, '')                    // Remove leading rating
              .replace(/watch\s*now\s*$/i, '')              // Remove "watch now" at end
              .replace(/^\s+|\s+$/g, '')                    // Trim whitespace
              .replace(/\s{2,}/g, ' ');                      // Remove extra spaces
            
            if (linkText) {
              result.title = linkText;
            }
          }

          // Try to extract poster from nearby image
          const posterAttr = $(element).data('poster') || 
                             $(element).find('img').attr('src') ||
                             $(element).find('img').attr('data-src');
          if (posterAttr) {
            result.poster = posterAttr;
          }

          // Build full URL for reference
          result.url = `https://movie-box.co${href}`;

          results.push(result);
          console.log(`[MovieBox] Extracted result: Slug=${slug}, Title=${result.title || 'N/A'}`);
        }
      } catch (err) {
        // Log but continue processing other links
        console.error(`[MovieBox] Error parsing link:`, err.message);
      }
    });

    console.log(`[MovieBox] Detail links scanned: ${detailLinksFound}`);
    console.log(`[MovieBox] Found ${results.length} unique results for query: "${query}"`);

    // If no results found, log debugging info
    if (results.length === 0) {
      console.log(`[MovieBox] No results found. Checking page structure...`);
      const allLinks = $('a').length;
      console.log(`[MovieBox] Total links in page: ${allLinks}`);
    }

    return results;
  } catch (error) {
    console.error(`[MovieBox] Search error for query "${query}":`, error.message);
    
    if (error.response) {
      console.error(`[MovieBox] Response status: ${error.response.status}`);
    }
    
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
