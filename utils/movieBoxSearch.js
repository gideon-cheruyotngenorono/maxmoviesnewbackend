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
 * Detect content type from title and other metadata
 * @param {string} title - Content title
 * @param {string} genre - Content genre
 * @returns {number} subjectType: 1=Movie, 2=Series, 3=Music, 7=Short-Series
 */
function detectContentType(title = '', genre = '') {
  const lowerTitle = (title || '').toLowerCase();
  const lowerGenre = (genre || '').toLowerCase();
  const combined = lowerTitle + ' ' + lowerGenre;
  
  // Series indicators (check FIRST because series take precedence)
  // Look for season/episode patterns or series-specific keywords
  const seriesPatterns = [
    /\bs\d+/i,           // S01, S1, S14, etc.
    /\be\d+/i,           // E01, E1, E14, etc.
    /season\s*\d+/i,     // Season 1, Season 01, etc.
    /episode\s*\d+/i,    // Episode 1, Episode 01, etc.
    /s\d+\s*e\d+/i,      // S01E01, S1E1, etc.
    /series/i,           // the word "series"
    /\bshow\b/i,         // the word "show"
    /\btv\b/i,           // the word "tv"
  ];
  
  if (seriesPatterns.some(pattern => pattern.test(combined))) {
    return 2; // Series
  }
  
  // Music indicators
  const musicKeywords = ['song', 'music', 'audio', 'track', 'album', 'single', 'remix', 'ft.', 'feat.', 'arbantone', 'russ millions', 'bongo', 'hiphop', 'classical', 'reggaetone', 'rnb', 'gengetone', 'afro beats', 'pop', 'gospel', 'instrumental'];
  if (musicKeywords.some(keyword => combined.includes(keyword))) {
    return 3; // Music
  }
  
  // Default to Movie
  return 1;
}

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

    // Step 7: Fetch each detail page to extract the numeric ID and cover image
    for (const link of detailLinks) {
      try {
        const detailResponse = await movieBoxClient.get(`/detail/${link.slug}`);
        const detailHtml = detailResponse.data;
        
        // Parse detail page with cheerio
        const detailPage = cheerio.load(detailHtml);
        
        // Look for the numeric ID in script tags (usually script 6)
        // The ID appears as large numbers in the NUXT data
        let numericId = null;
        let coverUrl = '';
        let genre = '';
        
        detailPage('script').each((i, el) => {
          const scriptContent = detailPage(el).html();
          if (scriptContent) {
            // Look for a 15+ digit number (the first one is usually the content ID)
            if (!numericId) {
              const idMatch = scriptContent.match(/(\d{15,})/);
              if (idMatch) {
                numericId = idMatch[1];
              }
            }
            
            // Extract genre from script data if present
            if (!genre && scriptContent.includes('genre')) {
              const genreMatch = scriptContent.match(/"genre"\s*:\s*"([^"]+)"/);
              if (genreMatch) {
                genre = genreMatch[1];
              }
            }
          }
        });
        
        // Extract cover image from img tags or meta tags
        // Look for poster/cover images in the page
        detailPage('img').each((i, el) => {
          const src = detailPage(el).attr('src');
          const alt = detailPage(el).attr('alt');
          const classes = detailPage(el).attr('class') || '';
          
          // Try to find the main poster image
          if (!coverUrl && src) {
            // Common patterns for poster images
            if (classes.includes('poster') || classes.includes('cover') || 
                alt?.toLowerCase().includes('poster') || alt?.toLowerCase().includes('cover') ||
                src.includes('poster') || src.includes('cover') || src.includes('image')) {
              coverUrl = src;
            }
          }
        });
        
        // If no cover found in img tags, try to extract from og:image meta tag
        if (!coverUrl) {
          const ogImage = detailPage('meta[property="og:image"]').attr('content');
          if (ogImage) {
            coverUrl = ogImage;
          }
        }
        
        // If still no cover, try common Movie Box image patterns
        if (!coverUrl) {
          detailPage('img[loading="lazy"]').each((i, el) => {
            const src = detailPage(el).attr('src');
            if (src && !coverUrl && src.includes('/')) {
              coverUrl = src;
              return false; // break
            }
          });
        }
        
        if (numericId) {
          // Extract and clean title from link text
          let title = link.linkText ? link.linkText.replace(/^\d+\.?\d*/, '').replace(/watch\s*now\s*$/i, '').trim() : 'Unknown';
          
          // Detect content type
          const subjectType = detectContentType(title, genre);
          
          // Normalize cover URL to absolute if needed
          let absoluteCoverUrl = coverUrl;
          if (coverUrl && !coverUrl.startsWith('http')) {
            if (coverUrl.startsWith('/')) {
              absoluteCoverUrl = 'https://movie-box.co' + coverUrl;
            } else {
              absoluteCoverUrl = 'https://movie-box.co/' + coverUrl;
            }
          }
          
          // Create item object matching original format
          const item = {
            subjectId: numericId,
            subjectType: subjectType, // 1=Movie, 2=Series, 3=Music, 7=Short-Series
            title: title,
            description: '',
            releaseDate: '',
            duration: 0,
            genre: genre,
            cover: {
              url: absoluteCoverUrl,
              width: 300,
              height: 450
            },
            countryName: '',
            imdbRatingValue: '0',
            hasResource: true,
            detailPath: link.slug,
            thumbnail: absoluteCoverUrl // For alternative property name used by frontend
          };
          
          items.push(item);
          const contentTypeLabel = {1: 'Movie', 2: 'Series', 3: 'Music', 7: 'Short'}[subjectType] || 'Unknown';
          console.log(`[MovieBox] Extracted: ID=${numericId}, Title=${title}, Type=${contentTypeLabel}, Cover=${absoluteCoverUrl ? '✓' : '✗'}`);
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
 * Enrich search results with real metadata from the Movie API
 * Uses numeric IDs from search to fetch full metadata including real thumbnails
 * 
 * @param {Array} searchItems - Items from searchMovieBox
 * @param {Function} getInfo - Optional function to fetch full metadata: async (id) => metadata
 * @returns {Promise<Array>} Enriched items with real thumbnails and metadata
 */
async function enrichSearchResults(searchItems, getInfo) {
  if (!getInfo || typeof getInfo !== 'function' || !searchItems || searchItems.length === 0) {
    return searchItems;
  }

  // Fetch full metadata for each item in parallel using getInfo
  const enrichedItems = await Promise.all(
    searchItems.map(async (item) => {
      try {
        const metadata = await getInfo(item.subjectId);
        
        // The API response structure includes results.subject
        if (metadata && metadata.results && metadata.results.subject) {
          const subject = metadata.results.subject;
          
          // Skip items without real cover/thumbnail from API
          if (!subject.cover && !subject.thumb) {
            return null; // Mark for filtering
          }
          
          // Use real thumbnail from API if available
          const apiCover = subject.cover;
          const apiThumb = subject.thumb;
          
          return {
            ...item,
            description: subject.description || item.description,
            releaseDate: subject.releaseDate || item.releaseDate,
            duration: subject.duration || item.duration,
            genre: subject.genre || item.genre,
            cover: apiCover,
            thumbnail: apiThumb || apiCover?.url,
            countryName: subject.countryName || item.countryName,
            imdbRatingValue: subject.imdbRatingValue || item.imdbRatingValue
          };
        }
        // No valid subject data - skip this item
        return null;
      } catch (err) {
        console.warn(`[MovieBox] Skipping ID ${item.subjectId} - API error: ${err.message}`);
        // Skip on error instead of returning partial data
        return null;
      }
    })
  );

  // Filter out null entries (items that couldn't be enriched with real data)
  return enrichedItems.filter(item => item !== null);
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
    if (!searchResult.items || searchResult.items.length === 0) {
      return searchResult;
    }

    // Enrich with metadata if getInfo is provided
    if (getInfo && typeof getInfo === 'function') {
      const enrichedItems = await enrichSearchResults(searchResult.items, getInfo);
      return {
        pager: searchResult.pager,
        items: enrichedItems
      };
    }

    // Return basic results if no enrichment function
    return searchResult;
  } catch (error) {
    console.error(`[MovieBox] Full search error for query "${query}":`, error.message);
    throw error;
  }
}

module.exports = {
  searchMovieBox,
  searchMovieBoxFull
};
