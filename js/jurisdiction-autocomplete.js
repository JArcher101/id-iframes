/* ===================================
   THIRDFORT JURISDICTION AUTOCOMPLETE
   ===================================
   
   Comprehensive autocomplete for:
   1. KYB Jurisdictions (2-char codes)
   2. Address Countries (3-char codes)
   3. Phone Country Codes (with flags)
   
   ===================================
*/

// Thirdfort-supported KYB jurisdictions (250+ worldwide)
const THIRDFORT_JURISDICTIONS = [
  // UK & Crown Dependencies
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'JE', name: 'Jersey' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'GI', name: 'Gibraltar' },
  
  // Europe
  { code: 'AL', name: 'Albania' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AT', name: 'Austria' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MT', name: 'Malta' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SM', name: 'San Marino' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'VA', name: 'Vatican City' },
  
  // Americas
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  
  // United States (all 50 states + territories)
  { code: 'US-AL', name: 'United States - Alabama' },
  { code: 'US-AK', name: 'United States - Alaska' },
  { code: 'US-AZ', name: 'United States - Arizona' },
  { code: 'US-AR', name: 'United States - Arkansas' },
  { code: 'US-CA', name: 'United States - California' },
  { code: 'US-CO', name: 'United States - Colorado' },
  { code: 'US-CT', name: 'United States - Connecticut' },
  { code: 'US-DE', name: 'United States - Delaware' },
  { code: 'US-DC', name: 'United States - District of Columbia' },
  { code: 'US-FL', name: 'United States - Florida' },
  { code: 'US-GA', name: 'United States - Georgia' },
  { code: 'US-HI', name: 'United States - Hawaii' },
  { code: 'US-ID', name: 'United States - Idaho' },
  { code: 'US-IL', name: 'United States - Illinois' },
  { code: 'US-IN', name: 'United States - Indiana' },
  { code: 'US-IA', name: 'United States - Iowa' },
  { code: 'US-KS', name: 'United States - Kansas' },
  { code: 'US-KY', name: 'United States - Kentucky' },
  { code: 'US-LA', name: 'United States - Louisiana' },
  { code: 'US-ME', name: 'United States - Maine' },
  { code: 'US-MD', name: 'United States - Maryland' },
  { code: 'US-MA', name: 'United States - Massachusetts' },
  { code: 'US-MI', name: 'United States - Michigan' },
  { code: 'US-MN', name: 'United States - Minnesota' },
  { code: 'US-MS', name: 'United States - Mississippi' },
  { code: 'US-MO', name: 'United States - Missouri' },
  { code: 'US-MT', name: 'United States - Montana' },
  { code: 'US-NE', name: 'United States - Nebraska' },
  { code: 'US-NV', name: 'United States - Nevada' },
  { code: 'US-NH', name: 'United States - New Hampshire' },
  { code: 'US-NJ', name: 'United States - New Jersey' },
  { code: 'US-NM', name: 'United States - New Mexico' },
  { code: 'US-NY', name: 'United States - New York' },
  { code: 'US-NC', name: 'United States - North Carolina' },
  { code: 'US-ND', name: 'United States - North Dakota' },
  { code: 'US-OH', name: 'United States - Ohio' },
  { code: 'US-OK', name: 'United States - Oklahoma' },
  { code: 'US-OR', name: 'United States - Oregon' },
  { code: 'US-PA', name: 'United States - Pennsylvania' },
  { code: 'US-RI', name: 'United States - Rhode Island' },
  { code: 'US-SC', name: 'United States - South Carolina' },
  { code: 'US-SD', name: 'United States - South Dakota' },
  { code: 'US-TN', name: 'United States - Tennessee' },
  { code: 'US-TX', name: 'United States - Texas' },
  { code: 'US-UT', name: 'United States - Utah' },
  { code: 'US-VT', name: 'United States - Vermont' },
  { code: 'US-VA', name: 'United States - Virginia' },
  { code: 'US-WA', name: 'United States - Washington' },
  { code: 'US-WV', name: 'United States - West Virginia' },
  { code: 'US-WI', name: 'United States - Wisconsin' },
  { code: 'US-WY', name: 'United States - Wyoming' },
  { code: 'US-AS', name: 'United States - American Samoa' },
  { code: 'US-GU', name: 'United States - Guam' },
  { code: 'US-MP', name: 'United States - Northern Mariana Islands' },
  { code: 'US-PR', name: 'United States - Puerto Rico' },
  { code: 'US-VI', name: 'United States - US Virgin Islands' },
  
  // Central & South America
  { code: 'AR', name: 'Argentina' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'PA', name: 'Panama' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
  
  // Caribbean
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BZ', name: 'Belize' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'GD', name: 'Grenada' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  
  // Asia-Pacific
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'JP', name: 'Japan' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'SG', name: 'Singapore' },
  { code: 'KR', name: 'South Korea' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  
  // Middle East
  { code: 'BH', name: 'Bahrain' },
  { code: 'IL', name: 'Israel' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'OM', name: 'Oman' },
  { code: 'QA', name: 'Qatar' },
  { code: 'SA', name: 'Saudi Arabia' },
  
  // United Arab Emirates (all 7 emirates)
  { code: 'AE-AZ', name: 'United Arab Emirates - Abu Dhabi' },
  { code: 'AE-AJ', name: 'United Arab Emirates - Ajman' },
  { code: 'AE-DU', name: 'United Arab Emirates - Dubai' },
  { code: 'AE-FU', name: 'United Arab Emirates - Fujairah' },
  { code: 'AE-RK', name: 'United Arab Emirates - Ras Al Khaimah' },
  { code: 'AE-SH', name: 'United Arab Emirates - Sharjah' },
  { code: 'AE-UQ', name: 'United Arab Emirates - Umm Al Quwain' },
  
  // Africa
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'MA', name: 'Morocco' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'TN', name: 'Tunisia' }
];

/**
 * Initialize jurisdiction autocomplete (2-char codes)
 */
function initializeJurisdictionAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  
  if (!input || !dropdown) return;
  
  let selectedJurisdiction = null;
  let clickInsideDropdown = false;
  
  // Handle input changes
  input.addEventListener('input', function() {
    const searchTerm = this.value.trim().toLowerCase();
    
    if (searchTerm.length < 2) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      selectedJurisdiction = null;
      return;
    }
    
    // Filter jurisdictions
    const matches = THIRDFORT_JURISDICTIONS.filter(j => {
      return j.name.toLowerCase().includes(searchTerm) || 
             j.code.toLowerCase().includes(searchTerm);
    });
    
    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item-empty">No jurisdictions found</div>';
      dropdown.classList.remove('hidden');
      return;
    }
    
    // Limit results to 10 most relevant
    const limitedMatches = matches.slice(0, 10);
    
    // Build dropdown HTML
    let html = '';
    limitedMatches.forEach(j => {
      html += `
        <div class="dropdown-item" data-code="${j.code}" data-name="${j.name}">
          <span class="jurisdiction-name">${j.name}</span>
          <span class="jurisdiction-code">${j.code}</span>
        </div>
      `;
    });
    
    if (matches.length > 10) {
      html += `<div class="dropdown-item-empty">${matches.length - 10} more... (keep typing to narrow down)</div>`;
    }
    
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    
    // Add click handlers to dropdown items using mousedown (fires before blur)
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      const handleSelection = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const code = this.dataset.code;
        const name = this.dataset.name;
        
        console.log('Selecting jurisdiction - code:', code, 'name:', name);
        
        input.value = name;
        input.dataset.jurisdictionCode = code;
        selectedJurisdiction = { code, name };
        
        dropdown.classList.add('hidden');
        
        console.log('Jurisdiction selected successfully:', selectedJurisdiction);
        console.log('Input value:', input.value, 'Dataset:', input.dataset.jurisdictionCode);
        
        // Trigger change event for any listeners
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Refocus input to prevent any focus issues
        setTimeout(() => input.blur(), 10);
      };
      
      item.addEventListener('mousedown', handleSelection);
      item.addEventListener('click', handleSelection);
    });
  });
  
  // Hide dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
  
  // Handle manual blur
  input.addEventListener('blur', function() {
    setTimeout(() => {
      if (this.value && !this.dataset.jurisdictionCode) {
        // Try to find exact match
        const exactMatch = THIRDFORT_JURISDICTIONS.find(j => 
          j.name.toLowerCase() === this.value.trim().toLowerCase() ||
          j.code.toLowerCase() === this.value.trim().toLowerCase()
        );
        
        if (exactMatch) {
          this.value = exactMatch.name;
          this.dataset.jurisdictionCode = exactMatch.code;
          selectedJurisdiction = exactMatch;
          
          // Trigger change event
          this.dispatchEvent(new Event('change'));
        }
      }
    }, 200);
  });
}

/**
 * Get selected jurisdiction code from autocomplete input
 */
function getSelectedJurisdiction(inputId) {
  const input = document.getElementById(inputId);
  return input?.dataset.jurisdictionCode || null;
}

/**
 * Set jurisdiction programmatically
 */
function setJurisdiction(inputId, code) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const jurisdiction = THIRDFORT_JURISDICTIONS.find(j => j.code === code);
  if (jurisdiction) {
    input.value = jurisdiction.name;
    input.dataset.jurisdictionCode = jurisdiction.code;
  }
}

/* ===================================
   ADDRESS COUNTRY AUTOCOMPLETE
   ===================================
   
   3-character ISO codes for address objects
   
   ===================================
*/

// Address countries (3-char ISO codes)
const ADDRESS_COUNTRIES = [
  { code: 'GBR', name: 'United Kingdom' },
  { code: 'USA', name: 'United States' },
  { code: 'CAN', name: 'Canada' },
  { code: 'AUS', name: 'Australia' },
  { code: 'NZL', name: 'New Zealand' },
  { code: 'IRL', name: 'Ireland' },
  { code: 'FRA', name: 'France' },
  { code: 'DEU', name: 'Germany' },
  { code: 'ESP', name: 'Spain' },
  { code: 'ITA', name: 'Italy' },
  { code: 'PRT', name: 'Portugal' },
  { code: 'NLD', name: 'Netherlands' },
  { code: 'BEL', name: 'Belgium' },
  { code: 'CHE', name: 'Switzerland' },
  { code: 'AUT', name: 'Austria' },
  { code: 'DNK', name: 'Denmark' },
  { code: 'SWE', name: 'Sweden' },
  { code: 'NOR', name: 'Norway' },
  { code: 'FIN', name: 'Finland' },
  { code: 'POL', name: 'Poland' },
  { code: 'GRC', name: 'Greece' },
  { code: 'TUR', name: 'Turkey' },
  { code: 'RUS', name: 'Russia' },
  { code: 'CHN', name: 'China' },
  { code: 'JPN', name: 'Japan' },
  { code: 'IND', name: 'India' },
  { code: 'BRA', name: 'Brazil' },
  { code: 'MEX', name: 'Mexico' },
  { code: 'ZAF', name: 'South Africa' },
  { code: 'ARE', name: 'United Arab Emirates' },
  { code: 'SAU', name: 'Saudi Arabia' },
  { code: 'SGP', name: 'Singapore' },
  { code: 'HKG', name: 'Hong Kong' },
  { code: 'KOR', name: 'South Korea' },
  { code: 'ARG', name: 'Argentina' },
  { code: 'CHL', name: 'Chile' },
  { code: 'COL', name: 'Colombia' },
  { code: 'PER', name: 'Peru' },
  { code: 'VEN', name: 'Venezuela' },
  { code: 'EGY', name: 'Egypt' },
  { code: 'NGA', name: 'Nigeria' },
  { code: 'KEN', name: 'Kenya' },
  { code: 'MAR', name: 'Morocco' },
  { code: 'THA', name: 'Thailand' },
  { code: 'VNM', name: 'Vietnam' },
  { code: 'MYS', name: 'Malaysia' },
  { code: 'IDN', name: 'Indonesia' },
  { code: 'PHL', name: 'Philippines' },
  { code: 'PAK', name: 'Pakistan' },
  { code: 'BGD', name: 'Bangladesh' },
  { code: 'ISR', name: 'Israel' },
  { code: 'CZE', name: 'Czech Republic' },
  { code: 'HUN', name: 'Hungary' },
  { code: 'ROU', name: 'Romania' },
  { code: 'BGR', name: 'Bulgaria' },
  { code: 'HRV', name: 'Croatia' },
  { code: 'SVK', name: 'Slovakia' },
  { code: 'SVN', name: 'Slovenia' },
  { code: 'EST', name: 'Estonia' },
  { code: 'LVA', name: 'Latvia' },
  { code: 'LTU', name: 'Lithuania' },
  { code: 'ISL', name: 'Iceland' },
  { code: 'LUX', name: 'Luxembourg' },
  { code: 'MLT', name: 'Malta' },
  { code: 'CYP', name: 'Cyprus' },
  { code: 'UKR', name: 'Ukraine' },
  { code: 'BLR', name: 'Belarus' },
  { code: 'SRB', name: 'Serbia' },
  { code: 'BIH', name: 'Bosnia and Herzegovina' },
  { code: 'ALB', name: 'Albania' },
  { code: 'MKD', name: 'North Macedonia' },
  { code: 'MNE', name: 'Montenegro' },
  { code: 'KAZ', name: 'Kazakhstan' },
  { code: 'GEO', name: 'Georgia' },
  { code: 'ARM', name: 'Armenia' },
  { code: 'AZE', name: 'Azerbaijan' },
  { code: 'IRN', name: 'Iran' },
  { code: 'IRQ', name: 'Iraq' },
  { code: 'JOR', name: 'Jordan' },
  { code: 'LBN', name: 'Lebanon' },
  { code: 'KWT', name: 'Kuwait' },
  { code: 'OMN', name: 'Oman' },
  { code: 'QAT', name: 'Qatar' },
  { code: 'BHR', name: 'Bahrain' },
  { code: 'YEM', name: 'Yemen' },
  { code: 'SYR', name: 'Syria' },
  { code: 'AFG', name: 'Afghanistan' },
  { code: 'LKA', name: 'Sri Lanka' },
  { code: 'NPL', name: 'Nepal' },
  { code: 'MMR', name: 'Myanmar' },
  { code: 'KHM', name: 'Cambodia' },
  { code: 'LAO', name: 'Laos' },
  { code: 'TWN', name: 'Taiwan' },
  { code: 'MNG', name: 'Mongolia' },
  { code: 'PRK', name: 'North Korea' }
];

/**
 * Initialize address country autocomplete (3-char codes)
 */
function initializeCountryAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  
  if (!input || !dropdown) return;
  
  let selectedCountry = null;
  
  // Handle input changes
  input.addEventListener('input', function() {
    const searchTerm = this.value.trim().toLowerCase();
    
    if (searchTerm.length < 1) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      selectedCountry = null;
      return;
    }
    
    // Filter countries
    const matches = ADDRESS_COUNTRIES.filter(c => {
      return c.name.toLowerCase().includes(searchTerm) || 
             c.code.toLowerCase().includes(searchTerm);
    });
    
    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item-empty">No countries found</div>';
      dropdown.classList.remove('hidden');
      return;
    }
    
    // Limit results to 10 most relevant
    const limitedMatches = matches.slice(0, 10);
    
    // Build dropdown HTML
    let html = '';
    limitedMatches.forEach(c => {
      html += `
        <div class="dropdown-item" data-code="${c.code}" data-name="${c.name}">
          <span class="jurisdiction-name">${c.name}</span>
          <span class="jurisdiction-code">${c.code}</span>
        </div>
      `;
    });
    
    if (matches.length > 10) {
      html += `<div class="dropdown-item-empty">${matches.length - 10} more... (keep typing to narrow down)</div>`;
    }
    
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    
    // Add click handlers to dropdown items using mousedown (fires before blur)
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      const handleSelection = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const code = this.dataset.code;
        const name = this.dataset.name;
        
        console.log('Selecting country - code:', code, 'name:', name);
        
        input.value = name;
        input.dataset.countryCode = code;
        selectedCountry = { code, name };
        
        dropdown.classList.add('hidden');
        
        console.log('Country selected successfully:', selectedCountry);
        console.log('Input value:', input.value, 'Dataset:', input.dataset.countryCode);
        
        // Trigger change event for any listeners
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Refocus input to prevent any focus issues
        setTimeout(() => input.blur(), 10);
      };
      
      item.addEventListener('mousedown', handleSelection);
      item.addEventListener('click', handleSelection);
    });
  });
  
  // Hide dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
  
  // Handle manual blur
  input.addEventListener('blur', function() {
    setTimeout(() => {
      if (this.value && !this.dataset.countryCode) {
        // Try to find exact match
        const exactMatch = ADDRESS_COUNTRIES.find(c => 
          c.name.toLowerCase() === this.value.trim().toLowerCase() ||
          c.code.toLowerCase() === this.value.trim().toLowerCase()
        );
        
        if (exactMatch) {
          this.value = exactMatch.name;
          this.dataset.countryCode = exactMatch.code;
          selectedCountry = exactMatch;
          
          // Trigger change event
          this.dispatchEvent(new Event('change'));
        }
      }
    }, 200);
  });
}

/**
 * Get selected country code from autocomplete input
 */
function getSelectedCountry(inputId) {
  const input = document.getElementById(inputId);
  return input?.dataset.countryCode || null;
}

/**
 * Set country programmatically
 */
function setCountry(inputId, code) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const country = ADDRESS_COUNTRIES.find(c => c.code === code);
  if (country) {
    input.value = country.name;
    input.dataset.countryCode = country.code;
  }
}

/* ===================================
   PHONE CODE AUTOCOMPLETE
   ===================================
   
   Searchable phone country codes
   Search by: country name, ISO code, or phone code
   Example: "GB", "UK", "United Kingdom", "44", "+44" all match UK
   
   ===================================
*/

// Phone country codes
const PHONE_COUNTRY_CODES = [
  // UK Default
  { code: 'GB', phone: '+44', flag: '&#xD83C;&#xDDEC;&#xD83C;&#xDDE7;', name: 'UK', searchTerms: ['uk', 'united kingdom', 'gb', 'britain', '44', '+44'] },
  
  // EU Countries
  { code: 'AT', phone: '+43', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDF9;', name: 'Austria', searchTerms: ['austria', 'at', '43', '+43'] },
  { code: 'BE', phone: '+32', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDEA;', name: 'Belgium', searchTerms: ['belgium', 'be', '32', '+32'] },
  { code: 'BG', phone: '+359', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDEC;', name: 'Bulgaria', searchTerms: ['bulgaria', 'bg', '359', '+359'] },
  { code: 'HR', phone: '+385', flag: '&#xD83C;&#xDDED;&#xD83C;&#xDDF7;', name: 'Croatia', searchTerms: ['croatia', 'hr', '385', '+385'] },
  { code: 'CY', phone: '+357', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDFE;', name: 'Cyprus', searchTerms: ['cyprus', 'cy', '357', '+357'] },
  { code: 'CZ', phone: '+420', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDFF;', name: 'Czech Republic', searchTerms: ['czech republic', 'czech', 'cz', '420', '+420'] },
  { code: 'DK', phone: '+45', flag: '&#xD83C;&#xDDE9;&#xD83C;&#xDDF0;', name: 'Denmark', searchTerms: ['denmark', 'dk', '45', '+45'] },
  { code: 'EE', phone: '+372', flag: '&#xD83C;&#xDDEA;&#xD83C;&#xDDEA;', name: 'Estonia', searchTerms: ['estonia', 'ee', '372', '+372'] },
  { code: 'FI', phone: '+358', flag: '&#xD83C;&#xDDEB;&#xD83C;&#xDDEE;', name: 'Finland', searchTerms: ['finland', 'fi', '358', '+358'] },
  { code: 'FR', phone: '+33', flag: '&#xD83C;&#xDDEB;&#xD83C;&#xDDF7;', name: 'France', searchTerms: ['france', 'fr', '33', '+33'] },
  { code: 'DE', phone: '+49', flag: '&#xD83C;&#xDDE9;&#xD83C;&#xDDEA;', name: 'Germany', searchTerms: ['germany', 'de', '49', '+49'] },
  { code: 'GR', phone: '+30', flag: '&#xD83C;&#xDDEC;&#xD83C;&#xDDF7;', name: 'Greece', searchTerms: ['greece', 'gr', '30', '+30'] },
  { code: 'HU', phone: '+36', flag: '&#xD83C;&#xDDED;&#xD83C;&#xDDFA;', name: 'Hungary', searchTerms: ['hungary', 'hu', '36', '+36'] },
  { code: 'IE', phone: '+353', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDEA;', name: 'Ireland', searchTerms: ['ireland', 'ie', '353', '+353'] },
  { code: 'IT', phone: '+39', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDF9;', name: 'Italy', searchTerms: ['italy', 'it', '39', '+39'] },
  { code: 'LV', phone: '+371', flag: '&#xD83C;&#xDDF1;&#xD83C;&#xDDFB;', name: 'Latvia', searchTerms: ['latvia', 'lv', '371', '+371'] },
  { code: 'LT', phone: '+370', flag: '&#xD83C;&#xDDF1;&#xD83C;&#xDDF9;', name: 'Lithuania', searchTerms: ['lithuania', 'lt', '370', '+370'] },
  { code: 'LU', phone: '+352', flag: '&#xD83C;&#xDDF1;&#xD83C;&#xDDFA;', name: 'Luxembourg', searchTerms: ['luxembourg', 'lu', '352', '+352'] },
  { code: 'MT', phone: '+356', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDF9;', name: 'Malta', searchTerms: ['malta', 'mt', '356', '+356'] },
  { code: 'NL', phone: '+31', flag: '&#xD83C;&#xDDF3;&#xD83C;&#xDDF1;', name: 'Netherlands', searchTerms: ['netherlands', 'nl', '31', '+31'] },
  { code: 'PL', phone: '+48', flag: '&#xD83C;&#xDDF5;&#xD83C;&#xDDF1;', name: 'Poland', searchTerms: ['poland', 'pl', '48', '+48'] },
  { code: 'PT', phone: '+351', flag: '&#xD83C;&#xDDF5;&#xD83C;&#xDDF9;', name: 'Portugal', searchTerms: ['portugal', 'pt', '351', '+351'] },
  { code: 'RO', phone: '+40', flag: '&#xD83C;&#xDDF7;&#xD83C;&#xDDF4;', name: 'Romania', searchTerms: ['romania', 'ro', '40', '+40'] },
  { code: 'SK', phone: '+421', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDF0;', name: 'Slovakia', searchTerms: ['slovakia', 'sk', '421', '+421'] },
  { code: 'SI', phone: '+386', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDEE;', name: 'Slovenia', searchTerms: ['slovenia', 'si', '386', '+386'] },
  { code: 'ES', phone: '+34', flag: '&#xD83C;&#xDDEA;&#xD83C;&#xDDF8;', name: 'Spain', searchTerms: ['spain', 'es', '34', '+34'] },
  { code: 'SE', phone: '+46', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDEA;', name: 'Sweden', searchTerms: ['sweden', 'se', '46', '+46'] },
  
  // Major Countries
  { code: 'AR', phone: '+54', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDF7;', name: 'Argentina', searchTerms: ['argentina', 'ar', '54', '+54'] },
  { code: 'AU', phone: '+61', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDFA;', name: 'Australia', searchTerms: ['australia', 'au', '61', '+61'] },
  { code: 'BR', phone: '+55', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDF7;', name: 'Brazil', searchTerms: ['brazil', 'br', '55', '+55'] },
  { code: 'CA', phone: '+1', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDE6;', name: 'Canada', searchTerms: ['canada', 'ca', '1', '+1'] },
  { code: 'CN', phone: '+86', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDF3;', name: 'China', searchTerms: ['china', 'cn', '86', '+86'] },
  { code: 'MX', phone: '+52', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDFD;', name: 'Mexico', searchTerms: ['mexico', 'mx', '52', '+52'] },
  { code: 'NZ', phone: '+64', flag: '&#xD83C;&#xDDF3;&#xD83C;&#xDDFF;', name: 'New Zealand', searchTerms: ['new zealand', 'nz', '64', '+64'] },
  { code: 'NO', phone: '+47', flag: '&#xD83C;&#xDDF3;&#xD83C;&#xDDF4;', name: 'Norway', searchTerms: ['norway', 'no', '47', '+47'] },
  { code: 'SG', phone: '+65', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDEC;', name: 'Singapore', searchTerms: ['singapore', 'sg', '65', '+65'] },
  { code: 'ZA', phone: '+27', flag: '&#xD83C;&#xDDFF;&#xD83C;&#xDDE6;', name: 'South Africa', searchTerms: ['south africa', 'za', '27', '+27'] },
  { code: 'CH', phone: '+41', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDED;', name: 'Switzerland', searchTerms: ['switzerland', 'ch', '41', '+41'] },
  { code: 'TR', phone: '+90', flag: '&#xD83C;&#xDDF9;&#xD83C;&#xDDF7;', name: 'Turkey', searchTerms: ['turkey', 'tr', '90', '+90'] },
  { code: 'US', phone: '+1', flag: '&#xD83C;&#xDDFA;&#xD83C;&#xDDF8;', name: 'USA', searchTerms: ['usa', 'us', 'united states', 'america', '1', '+1'] },
  
  // Other Countries (alphabetical)
  { code: 'AF', phone: '+93', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDEB;', name: 'Afghanistan', searchTerms: ['afghanistan', 'af', '93', '+93'] },
  { code: 'AL', phone: '+355', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDF1;', name: 'Albania', searchTerms: ['albania', 'al', '355', '+355'] },
  { code: 'DZ', phone: '+213', flag: '&#xD83C;&#xDDE9;&#xD83C;&#xDDFF;', name: 'Algeria', searchTerms: ['algeria', 'dz', '213', '+213'] },
  { code: 'AD', phone: '+376', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDE9;', name: 'Andorra', searchTerms: ['andorra', 'ad', '376', '+376'] },
  { code: 'AO', phone: '+244', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDF4;', name: 'Angola', searchTerms: ['angola', 'ao', '244', '+244'] },
  { code: 'AM', phone: '+374', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDF2;', name: 'Armenia', searchTerms: ['armenia', 'am', '374', '+374'] },
  { code: 'AZ', phone: '+994', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDFF;', name: 'Azerbaijan', searchTerms: ['azerbaijan', 'az', '994', '+994'] },
  { code: 'BH', phone: '+973', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDED;', name: 'Bahrain', searchTerms: ['bahrain', 'bh', '973', '+973'] },
  { code: 'BD', phone: '+880', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDE9;', name: 'Bangladesh', searchTerms: ['bangladesh', 'bd', '880', '+880'] },
  { code: 'BY', phone: '+375', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDFE;', name: 'Belarus', searchTerms: ['belarus', 'by', '375', '+375'] },
  { code: 'BZ', phone: '+501', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDFF;', name: 'Belize', searchTerms: ['belize', 'bz', '501', '+501'] },
  { code: 'BT', phone: '+975', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDF9;', name: 'Bhutan', searchTerms: ['bhutan', 'bt', '975', '+975'] },
  { code: 'BO', phone: '+591', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDF4;', name: 'Bolivia', searchTerms: ['bolivia', 'bo', '591', '+591'] },
  { code: 'BA', phone: '+387', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDE6;', name: 'Bosnia', searchTerms: ['bosnia', 'ba', '387', '+387'] },
  { code: 'BW', phone: '+267', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDFC;', name: 'Botswana', searchTerms: ['botswana', 'bw', '267', '+267'] },
  { code: 'BN', phone: '+673', flag: '&#xD83C;&#xDDE7;&#xD83C;&#xDDF3;', name: 'Brunei', searchTerms: ['brunei', 'bn', '673', '+673'] },
  { code: 'KH', phone: '+855', flag: '&#xD83C;&#xDDF0;&#xD83C;&#xDDED;', name: 'Cambodia', searchTerms: ['cambodia', 'kh', '855', '+855'] },
  { code: 'CM', phone: '+237', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDF2;', name: 'Cameroon', searchTerms: ['cameroon', 'cm', '237', '+237'] },
  { code: 'CL', phone: '+56', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDF1;', name: 'Chile', searchTerms: ['chile', 'cl', '56', '+56'] },
  { code: 'CO', phone: '+57', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDF4;', name: 'Colombia', searchTerms: ['colombia', 'co', '57', '+57'] },
  { code: 'CR', phone: '+506', flag: '&#xD83C;&#xDDE8;&#xD83C;&#xDDF7;', name: 'Costa Rica', searchTerms: ['costa rica', 'cr', '506', '+506'] },
  { code: 'CI', phone: '+225', flag: '🇨🇮', name: 'C&#xF4;te d\'Ivoire', searchTerms: ['cote divoire', 'ivory coast', 'ci', '225', '+225'] },
  { code: 'EC', phone: '+593', flag: '&#xD83C;&#xDDEA;&#xD83C;&#xDDE8;', name: 'Ecuador', searchTerms: ['ecuador', 'ec', '593', '+593'] },
  { code: 'EG', phone: '+20', flag: '&#xD83C;&#xDDEA;&#xD83C;&#xDDEC;', name: 'Egypt', searchTerms: ['egypt', 'eg', '20', '+20'] },
  { code: 'SV', phone: '+503', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDFB;', name: 'El Salvador', searchTerms: ['el salvador', 'sv', '503', '+503'] },
  { code: 'ET', phone: '+251', flag: '&#xD83C;&#xDDEA;&#xD83C;&#xDDF9;', name: 'Ethiopia', searchTerms: ['ethiopia', 'et', '251', '+251'] },
  { code: 'GE', phone: '+995', flag: '&#xD83C;&#xDDEC;&#xD83C;&#xDDEA;', name: 'Georgia', searchTerms: ['georgia', 'ge', '995', '+995'] },
  { code: 'GH', phone: '+233', flag: '&#xD83C;&#xDDEC;&#xD83C;&#xDDED;', name: 'Ghana', searchTerms: ['ghana', 'gh', '233', '+233'] },
  { code: 'GT', phone: '+502', flag: '&#xD83C;&#xDDEC;&#xD83C;&#xDDF9;', name: 'Guatemala', searchTerms: ['guatemala', 'gt', '502', '+502'] },
  { code: 'HN', phone: '+504', flag: '&#xD83C;&#xDDED;&#xD83C;&#xDDF3;', name: 'Honduras', searchTerms: ['honduras', 'hn', '504', '+504'] },
  { code: 'HK', phone: '+852', flag: '&#xD83C;&#xDDED;&#xD83C;&#xDDF0;', name: 'Hong Kong', searchTerms: ['hong kong', 'hk', '852', '+852'] },
  { code: 'IS', phone: '+354', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDF8;', name: 'Iceland', searchTerms: ['iceland', 'is', '354', '+354'] },
  { code: 'IN', phone: '+91', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDF3;', name: 'India', searchTerms: ['india', 'in', '91', '+91'] },
  { code: 'ID', phone: '+62', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDE9;', name: 'Indonesia', searchTerms: ['indonesia', 'id', '62', '+62'] },
  { code: 'IR', phone: '+98', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDF7;', name: 'Iran', searchTerms: ['iran', 'ir', '98', '+98'] },
  { code: 'IQ', phone: '+964', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDF6;', name: 'Iraq', searchTerms: ['iraq', 'iq', '964', '+964'] },
  { code: 'IL', phone: '+972', flag: '&#xD83C;&#xDDEE;&#xD83C;&#xDDF1;', name: 'Israel', searchTerms: ['israel', 'il', '972', '+972'] },
  { code: 'JP', phone: '+81', flag: '&#xD83C;&#xDDEF;&#xD83C;&#xDDF5;', name: 'Japan', searchTerms: ['japan', 'jp', '81', '+81'] },
  { code: 'JO', phone: '+962', flag: '&#xD83C;&#xDDEF;&#xD83C;&#xDDF4;', name: 'Jordan', searchTerms: ['jordan', 'jo', '962', '+962'] },
  { code: 'KZ', phone: '+7', flag: '&#xD83C;&#xDDF0;&#xD83C;&#xDDFF;', name: 'Kazakhstan', searchTerms: ['kazakhstan', 'kz', '7', '+7'] },
  { code: 'KE', phone: '+254', flag: '&#xD83C;&#xDDF0;&#xD83C;&#xDDEA;', name: 'Kenya', searchTerms: ['kenya', 'ke', '254', '+254'] },
  { code: 'KW', phone: '+965', flag: '&#xD83C;&#xDDF0;&#xD83C;&#xDDFC;', name: 'Kuwait', searchTerms: ['kuwait', 'kw', '965', '+965'] },
  { code: 'KG', phone: '+996', flag: '&#xD83C;&#xDDF0;&#xD83C;&#xDDEC;', name: 'Kyrgyzstan', searchTerms: ['kyrgyzstan', 'kg', '996', '+996'] },
  { code: 'LA', phone: '+856', flag: '&#xD83C;&#xDDF1;&#xD83C;&#xDDE6;', name: 'Laos', searchTerms: ['laos', 'la', '856', '+856'] },
  { code: 'LB', phone: '+961', flag: '&#xD83C;&#xDDF1;&#xD83C;&#xDDE7;', name: 'Lebanon', searchTerms: ['lebanon', 'lb', '961', '+961'] },
  { code: 'LY', phone: '+218', flag: '&#xD83C;&#xDDF1;&#xD83C;&#xDDFE;', name: 'Libya', searchTerms: ['libya', 'ly', '218', '+218'] },
  { code: 'MO', phone: '+853', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDF4;', name: 'Macau', searchTerms: ['macau', 'mo', '853', '+853'] },
  { code: 'MK', phone: '+389', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDF0;', name: 'Macedonia', searchTerms: ['macedonia', 'mk', '389', '+389'] },
  { code: 'MG', phone: '+261', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDEC;', name: 'Madagascar', searchTerms: ['madagascar', 'mg', '261', '+261'] },
  { code: 'MY', phone: '+60', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDFE;', name: 'Malaysia', searchTerms: ['malaysia', 'my', '60', '+60'] },
  { code: 'MV', phone: '+960', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDFB;', name: 'Maldives', searchTerms: ['maldives', 'mv', '960', '+960'] },
  { code: 'ML', phone: '+223', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDF1;', name: 'Mali', searchTerms: ['mali', 'ml', '223', '+223'] },
  { code: 'MA', phone: '+212', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDE6;', name: 'Morocco', searchTerms: ['morocco', 'ma', '212', '+212'] },
  { code: 'MZ', phone: '+258', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDFF;', name: 'Mozambique', searchTerms: ['mozambique', 'mz', '258', '+258'] },
  { code: 'MM', phone: '+95', flag: '&#xD83C;&#xDDF2;&#xD83C;&#xDDF2;', name: 'Myanmar', searchTerms: ['myanmar', 'burma', 'mm', '95', '+95'] },
  { code: 'NA', phone: '+264', flag: '&#xD83C;&#xDDF3;&#xD83C;&#xDDE6;', name: 'Namibia', searchTerms: ['namibia', 'na', '264', '+264'] },
  { code: 'NP', phone: '+977', flag: '&#xD83C;&#xDDF3;&#xD83C;&#xDDF5;', name: 'Nepal', searchTerms: ['nepal', 'np', '977', '+977'] },
  { code: 'NI', phone: '+505', flag: '&#xD83C;&#xDDF3;&#xD83C;&#xDDEE;', name: 'Nicaragua', searchTerms: ['nicaragua', 'ni', '505', '+505'] },
  { code: 'NG', phone: '+234', flag: '&#xD83C;&#xDDF3;&#xD83C;&#xDDEC;', name: 'Nigeria', searchTerms: ['nigeria', 'ng', '234', '+234'] },
  { code: 'OM', phone: '+968', flag: '&#xD83C;&#xDDF4;&#xD83C;&#xDDF2;', name: 'Oman', searchTerms: ['oman', 'om', '968', '+968'] },
  { code: 'PK', phone: '+92', flag: '&#xD83C;&#xDDF5;&#xD83C;&#xDDF0;', name: 'Pakistan', searchTerms: ['pakistan', 'pk', '92', '+92'] },
  { code: 'PA', phone: '+507', flag: '&#xD83C;&#xDDF5;&#xD83C;&#xDDE6;', name: 'Panama', searchTerms: ['panama', 'pa', '507', '+507'] },
  { code: 'PY', phone: '+595', flag: '&#xD83C;&#xDDF5;&#xD83C;&#xDDFE;', name: 'Paraguay', searchTerms: ['paraguay', 'py', '595', '+595'] },
  { code: 'PE', phone: '+51', flag: '&#xD83C;&#xDDF5;&#xD83C;&#xDDEA;', name: 'Peru', searchTerms: ['peru', 'pe', '51', '+51'] },
  { code: 'PH', phone: '+63', flag: '&#xD83C;&#xDDF5;&#xD83C;&#xDDED;', name: 'Philippines', searchTerms: ['philippines', 'ph', '63', '+63'] },
  { code: 'QA', phone: '+974', flag: '&#xD83C;&#xDDF6;&#xD83C;&#xDDE6;', name: 'Qatar', searchTerms: ['qatar', 'qa', '974', '+974'] },
  { code: 'RU', phone: '+7', flag: '&#xD83C;&#xDDF7;&#xD83C;&#xDDFA;', name: 'Russia', searchTerms: ['russia', 'ru', '7', '+7'] },
  { code: 'SA', phone: '+966', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDE6;', name: 'Saudi Arabia', searchTerms: ['saudi arabia', 'saudi', 'sa', '966', '+966'] },
  { code: 'RS', phone: '+381', flag: '&#xD83C;&#xDDF7;&#xD83C;&#xDDF8;', name: 'Serbia', searchTerms: ['serbia', 'rs', '381', '+381'] },
  { code: 'KR', phone: '+82', flag: '&#xD83C;&#xDDF0;&#xD83C;&#xDDF7;', name: 'South Korea', searchTerms: ['south korea', 'korea', 'kr', '82', '+82'] },
  { code: 'LK', phone: '+94', flag: '&#xD83C;&#xDDF1;&#xD83C;&#xDDF0;', name: 'Sri Lanka', searchTerms: ['sri lanka', 'lk', '94', '+94'] },
  { code: 'SD', phone: '+249', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDE9;', name: 'Sudan', searchTerms: ['sudan', 'sd', '249', '+249'] },
  { code: 'SY', phone: '+963', flag: '&#xD83C;&#xDDF8;&#xD83C;&#xDDFE;', name: 'Syria', searchTerms: ['syria', 'sy', '963', '+963'] },
  { code: 'TW', phone: '+886', flag: '&#xD83C;&#xDDF9;&#xD83C;&#xDDFC;', name: 'Taiwan', searchTerms: ['taiwan', 'tw', '886', '+886'] },
  { code: 'TJ', phone: '+992', flag: '&#xD83C;&#xDDF9;&#xD83C;&#xDDEF;', name: 'Tajikistan', searchTerms: ['tajikistan', 'tj', '992', '+992'] },
  { code: 'TZ', phone: '+255', flag: '&#xD83C;&#xDDF9;&#xD83C;&#xDDFF;', name: 'Tanzania', searchTerms: ['tanzania', 'tz', '255', '+255'] },
  { code: 'TH', phone: '+66', flag: '&#xD83C;&#xDDF9;&#xD83C;&#xDDED;', name: 'Thailand', searchTerms: ['thailand', 'th', '66', '+66'] },
  { code: 'TN', phone: '+216', flag: '&#xD83C;&#xDDF9;&#xD83C;&#xDDF3;', name: 'Tunisia', searchTerms: ['tunisia', 'tn', '216', '+216'] },
  { code: 'TM', phone: '+993', flag: '&#xD83C;&#xDDF9;&#xD83C;&#xDDF2;', name: 'Turkmenistan', searchTerms: ['turkmenistan', 'tm', '993', '+993'] },
  { code: 'UG', phone: '+256', flag: '&#xD83C;&#xDDFA;&#xD83C;&#xDDEC;', name: 'Uganda', searchTerms: ['uganda', 'ug', '256', '+256'] },
  { code: 'UA', phone: '+380', flag: '&#xD83C;&#xDDFA;&#xD83C;&#xDDE6;', name: 'Ukraine', searchTerms: ['ukraine', 'ua', '380', '+380'] },
  { code: 'AE', phone: '+971', flag: '&#xD83C;&#xDDE6;&#xD83C;&#xDDEA;', name: 'UAE', searchTerms: ['uae', 'emirates', 'ae', '971', '+971'] },
  { code: 'UY', phone: '+598', flag: '&#xD83C;&#xDDFA;&#xD83C;&#xDDFE;', name: 'Uruguay', searchTerms: ['uruguay', 'uy', '598', '+598'] },
  { code: 'UZ', phone: '+998', flag: '&#xD83C;&#xDDFA;&#xD83C;&#xDDFF;', name: 'Uzbekistan', searchTerms: ['uzbekistan', 'uz', '998', '+998'] },
  { code: 'VE', phone: '+58', flag: '&#xD83C;&#xDDFB;&#xD83C;&#xDDEA;', name: 'Venezuela', searchTerms: ['venezuela', 've', '58', '+58'] },
  { code: 'VN', phone: '+84', flag: '&#xD83C;&#xDDFB;&#xD83C;&#xDDF3;', name: 'Vietnam', searchTerms: ['vietnam', 'vn', '84', '+84'] },
  { code: 'YE', phone: '+967', flag: '&#xD83C;&#xDDFE;&#xD83C;&#xDDEA;', name: 'Yemen', searchTerms: ['yemen', 'ye', '967', '+967'] },
  { code: 'ZM', phone: '+260', flag: '&#xD83C;&#xDDFF;&#xD83C;&#xDDF2;', name: 'Zambia', searchTerms: ['zambia', 'zm', '260', '+260'] },
  { code: 'ZW', phone: '+263', flag: '&#xD83C;&#xDDFF;&#xD83C;&#xDDFC;', name: 'Zimbabwe', searchTerms: ['zimbabwe', 'zw', '263', '+263'] }
];

/**
 * Initialize phone code autocomplete
 */
function initializePhoneCodeAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  
  if (!input || !dropdown) return;
  
  let selectedPhoneCode = null;
  
  // Handle input changes
  input.addEventListener('input', function() {
    const searchTerm = this.value.trim().toLowerCase();
    
    if (searchTerm.length < 1) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      selectedPhoneCode = null;
      return;
    }
    
    // Filter phone codes - search across all search terms
    const matches = PHONE_COUNTRY_CODES.filter(p => {
      return p.searchTerms.some(term => term.includes(searchTerm));
    });
    
    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item-empty">No countries found</div>';
      dropdown.classList.remove('hidden');
      return;
    }
    
    // Limit results to 10 most relevant
    const limitedMatches = matches.slice(0, 10);
    
    // Build dropdown HTML
    let html = '';
    limitedMatches.forEach(p => {
      html += `
        <div class="dropdown-item" data-code="${p.code}" data-phone="${p.phone}" data-name="${p.name}">
          <span class="phone-display">${p.flag} ${p.phone} ${p.name}</span>
        </div>
      `;
    });
    
    if (matches.length > 10) {
      html += `<div class="dropdown-item-empty">${matches.length - 10} more... (keep typing to narrow down)</div>`;
    }
    
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    
    // Add click handlers to dropdown items using mousedown (fires before blur)
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      const handleSelection = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const code = this.dataset.code;
        const phone = this.dataset.phone;
        const name = this.dataset.name;
        const phoneObj = PHONE_COUNTRY_CODES.find(p => p.code === code);
        
        console.log('Selecting phone code - code:', code, 'phone:', phone, 'name:', name);
        
        input.value = `${phoneObj.flag} ${phone} ${name}`;
        input.dataset.phoneCode = phone;
        input.dataset.countryCode = code;
        selectedPhoneCode = { code, phone, name };
        
        dropdown.classList.add('hidden');
        
        console.log('Phone code selected successfully:', selectedPhoneCode);
        console.log('Input value:', input.value, 'Dataset:', input.dataset.phoneCode);
        
        // Trigger change event for any listeners
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Refocus input to prevent any focus issues
        setTimeout(() => input.blur(), 10);
      };
      
      item.addEventListener('mousedown', handleSelection);
      item.addEventListener('click', handleSelection);
    });
  });
  
  // Hide dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
  
  // Handle manual blur
  input.addEventListener('blur', function() {
    setTimeout(() => {
      if (this.value && !this.dataset.phoneCode) {
        // Try to find exact match by any search term
        const searchValue = this.value.trim().toLowerCase();
        const exactMatch = PHONE_COUNTRY_CODES.find(p => 
          p.searchTerms.some(term => term === searchValue)
        );
        
        if (exactMatch) {
          this.value = `${exactMatch.flag} ${exactMatch.phone} ${exactMatch.name}`;
          this.dataset.phoneCode = exactMatch.phone;
          this.dataset.countryCode = exactMatch.code;
          selectedPhoneCode = exactMatch;
          
          // Trigger change event
          this.dispatchEvent(new Event('change'));
        }
      }
    }, 200);
  });
}

/**
 * Get selected phone code from autocomplete input
 */
function getSelectedPhoneCode(inputId) {
  const input = document.getElementById(inputId);
  return input?.dataset.phoneCode || null;
}

/**
 * Set phone code programmatically
 */
function setPhoneCode(inputId, code) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  const phoneObj = PHONE_COUNTRY_CODES.find(p => p.code === code || p.phone === code);
  if (phoneObj) {
    input.value = `${phoneObj.flag} ${phoneObj.phone} ${phoneObj.name}`;
    input.dataset.phoneCode = phoneObj.phone;
    input.dataset.countryCode = phoneObj.code;
  }
}

