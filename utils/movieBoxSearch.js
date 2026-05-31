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
      return {
        pager: {
          hasMore: false,
          nextPage: null,
          page: '1',
          perPage: 24,
          totalCount: 0
        },
        items: []
      };
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
    const items = [];
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
          // Extract and clean title from link text
          let title = link.linkText ? link.linkText.replace(/^\d+\.?\d*/, '').replace(/watch\s*now\s*$/i, '').trim() : 'Unknown';
          
          // Create item object matching original format
          const item = {
            subjectId: numericId,
            subjectType: 1, // 1 = Movie/Series
            title: title,
            description: '',
            releaseDate: '',
            duration: 0,
            genre: '',
            cover: {
              url: '',
              width: 0,
              height: 0
            },
            countryName: '',
            imdbRatingValue: '0',
            hasResource: true,
            detailPath: link.slug
          };
          
          items.push(item);
          console.log(`[MovieBox] Extracted: ID=${numericId}, Title=${title}`);
        } else {
          console.log(`[MovieBox] Warning: Could not extract numeric ID from detail page: /detail/${link.slug}`);
        }
      } catch (detailErr) {
        console.warn(`[MovieBox] Error fetching detail page for ${link.slug}:`, detailErr.message);
        // Continue with next link
      }
    }

    console.log(`[MovieBox] Successfully extracted ${items.length} results for query: "${query}"`);

    // Return structured response with pagination
    return {
      pager: {
        hasMore: items.length >= 24,
        nextPage: items.length >= 24 ? '2' : null,
        page: '1',
        perPage: 24,
        totalCount: items.length
      },
      items: items
    };
  } catch (error) {
    console.error(`[MovieBox] Search error for query "${query}":`, error.message);
    
    if (error.response) {
      console.error(`[MovieBox] Response status: ${error.response.status}`);
    }
    
    // Return empty result structure on error
    if (error.response?.status === 404) {
      console.log(`[MovieBox] No results found for: "${query}"`);
      return {
        pager: {
          hasMore: false,
          nextPage: null,
          page: '1',
          perPage: 24,
          totalCount: 0
        },
        items: []
      };
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
    // First, get the basic search results with IDs and pagination
    const searchResult = await searchMovieBox(query);

    // If no getInfo function provided or no results, return basic results
    if (!getInfo || typeof getInfo !== 'function' || !searchResult.items || searchResult.items.length === 0) {
      return searchResult;
    }

    // Fetch full metadata for each item in parallel using getInfo
    const enrichedItems = await Promise.all(
      searchResult.items.map(async (item) => {
        try {
          const metadata = await getInfo(item.subjectId);
          // Merge metadata from getInfo into the item
          // getInfo returns full result from /info/{id}
          if (metadata && metadata.results && metadata.results.subject) {
            const subject = metadata.results.subject;
            return {
              ...item,
              description: subject.description || item.description,
              releaseDate: subject.releaseDate || item.releaseDate,
              duration: subject.duration || item.duration,
              genre: subject.genre || item.genre,
              cover: subject.cover || item.cover,
              countryName: subject.countryName || item.countryName,
              imdbRatingValue: subject.imdbRatingValue || item.imdbRatingValue
            };
          }
          return item;
        } catch (err) {
          console.error(`[MovieBox] Error fetching metadata for ID ${item.subjectId}:`, err.message);
          return item; // Return basic item if enrichment fails
        }
      })
    );

    // Return enriched results with same pagination structure
    return {
      pager: searchResult.pager,
      items: enrichedItems
    };
  } catch (error) {
    console.error(`[MovieBox] Full search error for query "${query}":`, error.message);
    throw error;
  }
}

module.exports = {
  searchMovieBox,
  searchMovieBoxFull
};
