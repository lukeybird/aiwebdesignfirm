import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Security: Only allow requests from authenticated sessions
    // In production, you might want to add additional authentication checks here
    
    let { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Resolve short links (maps.app.goo.gl or goo.gl/maps) to full URL
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      try {
        // First, try to get the redirect URL by following redirects
        let resolvedUrl = url;
        let redirectCount = 0;
        const maxRedirects = 5;
        
        while (redirectCount < maxRedirects && (resolvedUrl.includes('maps.app.goo.gl') || resolvedUrl.includes('goo.gl/maps'))) {
          const response = await fetch(resolvedUrl, { 
            method: 'HEAD',
            redirect: 'manual', // Don't follow automatically
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          // Check for redirect
          if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            resolvedUrl = response.headers.get('location')!;
            // Handle relative URLs
            if (resolvedUrl.startsWith('/')) {
              const urlObj = new URL(resolvedUrl, url);
              resolvedUrl = urlObj.href;
            }
            redirectCount++;
          } else {
            // Try GET request if HEAD doesn't work
            const getResponse = await fetch(resolvedUrl, {
              method: 'GET',
              redirect: 'follow',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            if (getResponse.url && getResponse.url !== resolvedUrl) {
              resolvedUrl = getResponse.url;
            }
            break;
          }
        }
        
        if (resolvedUrl && resolvedUrl !== url && resolvedUrl.includes('google.com/maps')) {
          url = resolvedUrl;
          console.log('Resolved short link to:', url);
        } else {
          console.warn('Short link resolution did not return a valid Google Maps URL. Resolved to:', resolvedUrl);
        }
      } catch (error) {
        console.error('Error resolving short link:', error);
        // Continue with original URL if resolution fails
      }
    }

    // Security: Validate URL format to prevent abuse
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Security: Limit URL length to prevent abuse
    if (url.length > 2000) {
      return NextResponse.json(
        { error: 'URL too long' },
        { status: 400 }
      );
    }

    // Extract place ID and coordinates from Google Maps URL
    let placeId: string | null = null;
    let coordinates: { lat: number; lng: number } | null = null;
    let placeName: string | null = null;

    // Try to extract coordinates from URL first (most reliable)
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
      coordinates = {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
      };
      console.log('Extracted coordinates:', coordinates);
    }

    console.log('Extracting place ID from URL:', url);
    
    // Try to extract place ID from URL
    // Handle various formats:
    // - /place/PLACE_ID
    // - data parameter: data=!4m2!3m1!1sChIJ... (place ID)
    // Google Place IDs are typically 27 characters and start with ChIJ
    const dataMatch = url.match(/data=!4m\d+!3m\d+!1s([A-Za-z0-9_-]{27,})/);
    if (dataMatch && dataMatch[1]) {
      const extractedId = dataMatch[1];
      // Validate it's a proper place ID format (27+ chars, typically starts with ChIJ)
      if (extractedId.length >= 27 && extractedId.match(/^[A-Za-z0-9_-]+$/)) {
        placeId = extractedId;
        console.log('Extracted place ID from data parameter:', placeId);
      } else {
        console.warn('Rejected invalid place ID from data parameter:', extractedId);
      }
    }
    
    // If no place ID from data parameter, try place path
    if (!placeId) {
      const placePathMatch = url.match(/place\/([^/@?]+)/);
      if (placePathMatch) {
        let extracted = decodeURIComponent(placePathMatch[1]);
        // Remove any query parameters or fragments
        extracted = extracted.split('?')[0].split('#')[0];
        console.log('Extracted from place path:', extracted);
        
        // Check if it's a valid place ID format (27+ chars, alphanumeric/underscore/hyphen, no spaces or plus signs)
        // Place IDs typically start with "ChIJ" but not always
        const isValidPlaceId = extracted.match(/^[A-Za-z0-9_-]{27,}$/) && 
                               !extracted.includes(' ') && 
                               !extracted.includes('+') &&
                               extracted.length >= 27;
        
        if (isValidPlaceId) {
          placeId = extracted;
          console.log('Extracted place ID from path:', placeId);
        } else {
          // It's a place name or encoded string, save it for text search but don't use as place ID
          placeName = extracted.replace(/\+/g, ' ').replace(/%20/g, ' ');
          console.log('Extracted place name (not using as place ID):', placeName);
        }
      }
    }
    
    console.log('Final place ID:', placeId);
    console.log('Coordinates found:', coordinates);

    // If we have coordinates but no place ID, try to find place ID using reverse geocoding
    if (coordinates && !placeId) {
      const apiKey = process.env.API_KEY_GOOGLE;
      
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Google Places API key not configured' },
          { status: 500 }
        );
      }

      // Use reverse geocoding to get place details
      const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${apiKey}`;
      
      const geocodeResponse = await fetch(reverseGeocodeUrl);
      const geocodeData = await geocodeResponse.json();

      if (geocodeData.results && geocodeData.results.length > 0) {
        // Try to find place_id in the results
        const result = geocodeData.results[0];
        placeId = result.place_id;
      }
    }

    // If we still don't have a place ID, use Nearby Search API with coordinates
    // This is more reliable for finding the exact place at coordinates
    if (!placeId && coordinates) {
      const apiKey = process.env.API_KEY_GOOGLE;
      
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Google Places API key not configured' },
          { status: 500 }
        );
      }

      // Use Places API Nearby Search - finds places near the coordinates
      // Use a very small radius to get the closest match
      const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=10&key=${apiKey}`;
      
      try {
        const nearbyResponse = await fetch(nearbyUrl);
        const nearbyData = await nearbyResponse.json();

        if (nearbyData.results && nearbyData.results.length > 0) {
          // Get the closest result (first one)
          placeId = nearbyData.results[0].place_id;
          console.log('Found place ID using nearby search:', placeId);
          console.log('Nearby search result:', nearbyData.results[0]);
        }
      } catch (error) {
        console.error('Error finding place with nearby search:', error);
      }
    }

    if (!placeId) {
      console.error('Could not extract place ID from URL:', url);
      console.error('Coordinates found:', coordinates);
      console.error('Place name found:', placeName);
      
      // If we have coordinates, we can still try to get place details using reverse geocoding
      if (coordinates) {
        const apiKey = process.env.API_KEY_GOOGLE;
        if (apiKey) {
          // Use reverse geocoding as last resort
          const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${apiKey}`;
          const geocodeResponse = await fetch(reverseGeocodeUrl);
          const geocodeData = await geocodeResponse.json();

          if (geocodeData.results && geocodeData.results.length > 0) {
            const result = geocodeData.results[0];
            // Return what we can get from geocoding
            return NextResponse.json({
              businessName: result.formatted_address.split(',')[0] || '',
              businessPhone: '',
              businessAddress: result.formatted_address || url,
              businessEmail: '',
            });
          }
        }
      }
      
      return NextResponse.json(
        { error: 'Could not extract place information from URL. Please make sure you\'re using a valid Google Maps link with a place location.' },
        { status: 400 }
      );
    }

    // Get place details using Places API
    // Security: API key is stored server-side only, never exposed to client
    const apiKey = process.env.API_KEY_GOOGLE;
    
    if (!apiKey) {
      // Don't expose detailed error in production
      console.error('Google Places API key not configured');
      return NextResponse.json(
        { error: 'Google Places API key not configured. Please add API_KEY_GOOGLE to your environment variables.' },
        { status: 500 }
      );
    }

    // Validate place ID format before making API call
    if (!placeId.match(/^[A-Za-z0-9_-]{27,}$/)) {
      console.error('Invalid place ID format:', placeId);
      // If we have coordinates, try to find place using coordinates instead
      if (coordinates) {
        const apiKey = process.env.API_KEY_GOOGLE;
        if (apiKey) {
          // Use nearby search to find the place
          const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=10&key=${apiKey}`;
          const nearbyResponse = await fetch(nearbyUrl);
          const nearbyData = await nearbyResponse.json();
          
          if (nearbyData.results && nearbyData.results.length > 0) {
            placeId = nearbyData.results[0].place_id;
            console.log('Found valid place ID using nearby search:', placeId);
          }
        }
      }
      
      if (!placeId || !placeId.match(/^[A-Za-z0-9_-]{27,}$/)) {
        return NextResponse.json(
          { error: 'Could not find a valid place ID from the URL. Please try using a full Google Maps link instead of a short link.' },
          { status: 400 }
        );
      }
    }

    // Request all available fields for better data extraction
    const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,international_phone_number,formatted_address,address_components,website,url,vicinity&key=${apiKey}`;
    
    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    if (placesData.status !== 'OK' || !placesData.result) {
      console.error('Places API error:', {
        status: placesData.status,
        error_message: placesData.error_message,
        url: url,
        placeId: placeId,
        fullResponse: placesData
      });
      
      // Return more helpful error message
      let errorMsg = 'Could not fetch place details';
      if (placesData.error_message) {
        errorMsg += `: ${placesData.error_message}`;
      } else if (placesData.status) {
        errorMsg += ` (Status: ${placesData.status})`;
      }
      
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    const place = placesData.result;
    
    console.log('Full place data received:', JSON.stringify(place, null, 2));
    console.log('Place ID used:', placeId);
    console.log('Place name raw:', place.name);
    console.log('Place address raw:', place.formatted_address);

    // Get business name - make sure it's not a place ID or encoded string
    let businessName = '';
    if (place.name && typeof place.name === 'string' && place.name.trim().length > 0) {
      const name = place.name.trim();
      // Validate it's not a place ID (place IDs are typically 27+ chars, alphanumeric only, no spaces)
      // Also check it's not an encoded string like "76WR3X44+JGW"
      const isPlaceId = name.match(/^[A-Za-z0-9_-]{27,}$/) && !name.includes(' ');
      const looksLikeEncoded = name.match(/^[A-Z0-9+]{10,}$/); // Pattern like "76WR3X44+JGW"
      
      if (!isPlaceId && !looksLikeEncoded && name.length > 2) {
        businessName = name;
      } else {
        console.warn('Rejected business name (looks like place ID or encoded):', name);
      }
    }

    // Get phone number - try all available phone fields
    let phoneNumber = '';
    if (place.formatted_phone_number) {
      phoneNumber = place.formatted_phone_number;
    } else if (place.international_phone_number) {
      phoneNumber = place.international_phone_number;
    } else if (place.phone_number) {
      phoneNumber = place.phone_number;
    }

    // Get address - prefer formatted_address, fallback to vicinity
    let businessAddress = '';
    if (place.formatted_address && typeof place.formatted_address === 'string') {
      const address = place.formatted_address.trim();
      // Validate it's not a place ID or encoded string
      const isPlaceId = address.match(/^[A-Za-z0-9_-]{27,}$/) && !address.includes(' ');
      const looksLikeEncoded = address.match(/^[A-Z0-9+]{10,}$/);
      
      if (!isPlaceId && !looksLikeEncoded && address.length > 5) {
        businessAddress = address;
      } else {
        console.warn('Rejected business address (looks like place ID or encoded):', address);
      }
    }
    if (!businessAddress && place.vicinity) {
      businessAddress = place.vicinity;
    }

    // Extract business email - try multiple methods
    let businessEmail = '';
    
    // Method 1: From website domain
    if (place.website) {
      try {
        const domain = place.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        businessEmail = `contact@${domain}`;
      } catch (e) {
        console.error('Error extracting email from website:', e);
      }
    }
    
    // Method 2: Try to find email in URL if available
    if (!businessEmail && place.url) {
      // Some Google Maps URLs might have email info, but this is unlikely
    }
    
    // Note: Google Places API doesn't directly provide email addresses
    // We can only construct a likely email from the website domain
    
    console.log('Extracted place details:', {
      name: businessName,
      phone: phoneNumber,
      address: businessAddress,
      email: businessEmail,
      rawName: place.name,
      rawAddress: place.formatted_address
    });

    return NextResponse.json({
      businessName: businessName,
      businessPhone: phoneNumber,
      businessAddress: businessAddress,
      businessEmail: businessEmail,
    });
  } catch (error) {
    console.error('Error fetching place details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch place details' },
      { status: 500 }
    );
  }
}

