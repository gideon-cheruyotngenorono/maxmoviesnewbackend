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
    const detailLinks = [];
    
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
            return;
          }

          const slug = slugMatch[1];

          // Skip if we've already seen this slug (deduplication)
          if (seenSlugs.has(slug)) {
            return;
          }

          seenSlugs.add(slug);
          
          // Store full href for later ID extraction
          detailLinks.push({
            slug: slug,
            href: href,
            linkText: $(element).text().trim()
          });

        }
      } catch (err) {
        // Log but continue processing other links
        console.error(`[MovieBox] Error parsing link:`, err.message);
      }
    });

    console.log(`[MovieBox] Detail links scanned: ${detailLinksFound}`);
    console.log(`[MovieBox] Found ${detailLinks.length} unique links for query: "${query}"`);
    console.log(`[MovieBox] Fetching numeric IDs from detail pages...`);

    // Step 7: Fetch each detail page to extract the numeric ID
    for (const link of detailLinks) {
      try {
        const detailResponse = await movieBoxClient.get(`/detail/${link.slug}`);
        const detailHtml = detailResponse.data;
        
        // Parse detail page with cheerio
        const detailPage = cheerio.load(detailHtml);
        
        // Look for the numeric ID in script tags (usually script 6)
        // The ID appears as large numbers in the NUXT data
        let numericId = null;
        
        detailPage('script').each((i, el) => {
          const scriptContent = detailPage(el).html();
          if (scriptContent && !numericId) {
            // Look for a 15+ digit number (the first one is usually the content ID)
            const idMatch = scriptContent.match(/(\d{15,})/);
            if (idMatch) {
              numericId = idMatch[1];
            }
          }
        });
        
        if (numericId) {
          // For the basic search we only return numeric IDs (as strings)
          results.push(String(numericId));
          // Log a concise extraction message
          let prettyTitle = link.linkText ? link.linkText.replace(/^\d+\.?\d*/, '').replace(/watch\s*now\s*$/i, '').trim() : 'N/A';
          console.log(`[MovieBox] Extracted numeric ID=${numericId}, Title=${prettyTitle}`);
        } else {
          console.log(`[MovieBox] Warning: Could not extract numeric ID from detail page: /detail/${link.slug}`);
        }
      } catch (detailErr) {
        console.warn(`[MovieBox] Error fetching detail page for ${link.slug}:`, detailErr.message);
        // Continue with next link
      }
    }

    console.log(`[MovieBox] Successfully extracted ${results.length} results for query: "${query}"`);

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

    // basicResults might be an array of numeric ID strings (['5034...', ...])
    // or an array of objects { id, title, slug, url }
    const ids = basicResults.map((r) => (typeof r === 'string' ? r : r.id));

    // Fetch full metadata for each ID in parallel using getInfo
    const fullResults = await Promise.all(
      ids.map(async (id, idx) => {
        try {
          const metadata = await getInfo(id);
          // Merge with any basic result info if provided
          const basic = basicResults[idx] && typeof basicResults[idx] === 'object' ? basicResults[idx] : { id };
          return {
            ...basic,
            ...metadata
          };
        } catch (err) {
          console.error(`[MovieBox] Error fetching metadata for ID ${id}:`, err.message);
          return { id };
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
