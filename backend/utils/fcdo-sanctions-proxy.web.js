import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';

/*
=====================================================================
FCDO SANCTIONS LIST PROXY
=====================================================================
Fetches the FCDO UK Sanctions List HTML and returns it to the frontend.
This proxy is needed because CORS policy blocks direct client-side fetch.

CACHING:
- Caches the HTML for 24 hours (sanctions list doesn't change frequently)
- Reduces load on FCDO servers and improves performance

USAGE:
- Called by parent page when sanctions-search.html iframe sends 'request-sanctions-html'
- Returns HTML string to be sent to iframe via postMessage
=====================================================================
*/

const FCDO_SANCTIONS_URL = 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml';

// In-memory cache (resets on backend restart)
let htmlCache = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/*
Fetch FCDO sanctions list HTML (with caching)
Returns: { html: string, cached: boolean }
*/
export const getFCDOSanctionsHTML = webMethod(
  Permissions.Anyone,
  async () => {
  try {
    console.log('&#xD83D;&#xDCE1; getFCDOSanctionsHTML called');
    
    // Check in-memory cache
    if (htmlCache && cacheTimestamp) {
      const cacheAge = Date.now() - cacheTimestamp;
      if (cacheAge < CACHE_DURATION_MS) {
        console.log(`&#x2705; Using cached sanctions XML (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        return {
          xml: htmlCache,
          cached: true,
          size: htmlCache.length
        };
      } else {
        console.log('⚠️ Cache expired, fetching fresh data');
      }
    }
    
    // Fetch from FCDO
    console.log('&#xD83D;&#xDD0D; Fetching from FCDO:', FCDO_SANCTIONS_URL);
    const response = await fetch(FCDO_SANCTIONS_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Thurstan-Hoskin-Sanctions-Check/1.0',
        'Accept': 'application/xml, text/xml'
      }
    });
    
    if (!response.ok) {
      console.error(`&#x274C; FCDO returned status ${response.status}`);
      throw new Error(`FCDO API returned status ${response.status}`);
    }
    
    const xml = await response.text();
    console.log(`&#x2705; Fetched ${xml.length} characters XML from FCDO`);
    
    // Cache the XML in memory
    htmlCache = xml;
    cacheTimestamp = Date.now();
    
    return {
      xml: xml,
      cached: false,
      size: xml.length
    };
    
  } catch (error) {
    console.error('&#x274C; Error in getFCDOSanctionsHTML:', error);
    
    // If we have stale cache, return it with warning
    if (htmlCache) {
      console.log('⚠️ Returning stale cache due to fetch error');
      return {
        xml: htmlCache,
        cached: true,
        stale: true,
        error: error.message
      };
    }
    
    throw new Error(`Failed to fetch sanctions list: ${error.message}`);
  }
});

