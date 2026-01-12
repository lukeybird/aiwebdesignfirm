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

    // Try to extract place ID from URL
    // Handle various formats:
    // - /place/PLACE_ID
    // - data parameter: data=!4m2!3m1!1sChIJ... (place ID)
    // Google Place IDs are typically 27 characters and start with ChIJ
    const dataMatch = url.match(/data=!4m\d+!3m\d+!1s([A-Za-z0-9_-]{27,})/);
    if (dataMatch && dataMatch[1]) {
      const extractedId = dataMatch[1];
      // Validate it's a proper place ID format
      if (extractedId.length >= 27 && extractedId.match(/^[A-Za-z0-9_-]+$/)) {
        placeId = extractedId;
        console.log('Extracted place ID from data parameter:', placeId);
      }
    }
    
    // If no place ID from data parameter, try place path
    if (!placeId) {
      const placePathMatch = url.match(/place\/([^/@?]+)/);
      if (placePathMatch) {
        let extracted = decodeURIComponent(placePathMatch[1]);
        // Remove any query parameters or fragments
        extracted = extracted.split('?')[0].split('#')[0];
        // Check if it's a valid place ID format (27+ chars, alphanumeric/underscore/hyphen)
        if (extracted.match(/^[A-Za-z0-9_-]{27,}$/) && !extracted.includes(' ') && !extracted.includes('+')) {
          placeId = extracted;
          console.log('Extracted place ID from path:', placeId);
        } else {
          // It's a place name, save it for text search
          placeName = extracted.replace(/\+/g, ' ').replace(/%20/g, ' ');
          console.log('Extracted place name:', placeName);
        }
      }
    }

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

    // If we still don't have a place ID, use Find Place API with coordinates
    if (!placeId && coordinates) {
      const apiKey = process.env.API_KEY_GOOGLE;
      
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Google Places API key not configured' },
          { status: 500 }
        );
      }

      // Use Places API Find Place - more reliable than nearby search
      // This finds the place at the exact coordinates
      const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${coordinates.lat},${coordinates.lng}&inputtype=textquery&locationbias=circle:50@${coordinates.lat},${coordinates.lng}&fields=place_id,name,formatted_phone_number,formatted_address,website,international_phone_number&key=${apiKey}`;
      
      try {
        const findPlaceResponse = await fetch(findPlaceUrl);
        const findPlaceData = await findPlaceResponse.json();

        if (findPlaceData.candidates && findPlaceData.candidates.length > 0) {
          placeId = findPlaceData.candidates[0].place_id;
          console.log('Found place ID using Find Place API:', placeId);
        } else {
          // Fallback to nearby search
          const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=50&key=${apiKey}`;
          const nearbyResponse = await fetch(nearbyUrl);
          const nearbyData = await nearbyResponse.json();

          if (nearbyData.results && nearbyData.results.length > 0) {
            placeId = nearbyData.results[0].place_id;
            console.log('Found place ID using nearby search:', placeId);
          }
        }
      } catch (error) {
        console.error('Error finding place:', error);
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

    const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,formatted_address,website,international_phone_number&key=${apiKey}`;
    
    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    if (placesData.status !== 'OK' || !placesData.result) {
      console.error('Places API error:', {
        status: placesData.status,
        error_message: placesData.error_message,
        url: url,
        placeId: placeId
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

    // Extract business email from website if possible (this is a best guess)
    let businessEmail = '';
    if (place.website) {
      // Try to construct email from website domain
      const domain = place.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      businessEmail = `contact@${domain}`;
    }

    // Get phone number - prefer formatted, fallback to international
    let phoneNumber = '';
    if (place.formatted_phone_number) {
      phoneNumber = place.formatted_phone_number;
    } else if (place.international_phone_number) {
      phoneNumber = place.international_phone_number;
    }
    
    console.log('Place details:', {
      name: place.name,
      phone: phoneNumber,
      address: place.formatted_address,
      email: businessEmail
    });

    return NextResponse.json({
      businessName: place.name || '',
      businessPhone: phoneNumber,
      businessAddress: place.formatted_address || '',
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

