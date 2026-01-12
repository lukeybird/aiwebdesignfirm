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
        // Use GET request to follow redirects and get the full URL
        const response = await fetch(url, { 
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        // The final URL after redirects
        const finalUrl = response.url;
        if (finalUrl && finalUrl !== url && finalUrl.includes('google.com/maps')) {
          url = finalUrl;
          console.log('Resolved short link to:', url);
        } else {
          console.warn('Short link resolution did not return a valid Google Maps URL');
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

    // Extract place ID from Google Maps URL
    // Supports formats like:
    // https://www.google.com/maps/place/.../@lat,lng,zoom/data=...
    // https://maps.google.com/?q=...
    // https://www.google.com/maps/search/...
    
    let placeId: string | null = null;
    let coordinates: { lat: number; lng: number } | null = null;

    // Try to extract place ID from URL
    const placeIdMatch = url.match(/place\/([^/]+)/);
    if (placeIdMatch) {
      placeId = placeIdMatch[1].split('/')[0];
    }

    // Try to extract coordinates from URL
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
      coordinates = {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
      };
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

    // If we still don't have a place ID, try to search by coordinates
    if (!placeId && coordinates) {
      const apiKey = process.env.API_KEY_GOOGLE;
      
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Google Places API key not configured' },
          { status: 500 }
        );
      }

      // Use Places API nearby search
      const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=50&key=${apiKey}`;
      
      const nearbyResponse = await fetch(nearbyUrl);
      const nearbyData = await nearbyResponse.json();

      if (nearbyData.results && nearbyData.results.length > 0) {
        placeId = nearbyData.results[0].place_id;
      }
    }

    if (!placeId) {
      console.error('Could not extract place ID from URL:', url);
      return NextResponse.json(
        { error: 'Could not extract place information from URL. Please make sure you\'re using a valid Google Maps link.' },
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

    return NextResponse.json({
      businessName: place.name || '',
      businessPhone: place.formatted_phone_number || place.international_phone_number || '',
      businessAddress: place.formatted_address || url,
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

