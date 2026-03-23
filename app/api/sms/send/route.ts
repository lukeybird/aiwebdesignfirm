import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// POST - Send SMS to multiple clients
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumbers, message } = body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Phone numbers array is required' },
        { status: 400 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message text is required' },
        { status: 400 }
      );
    }

    // Check if Twilio is configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { 
          error: 'Twilio is not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment variables.',
          details: 'Get these from your Twilio Console: https://console.twilio.com'
        },
        { status: 500 }
      );
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Validate and format phone numbers
    const validPhoneNumbers = phoneNumbers
      .map((phone: string) => {
        if (!phone) return null;
        // Remove all non-digit characters except +
        const cleaned = phone.replace(/[^\d+]/g, '');
        // If it doesn't start with +, add +1 for US numbers
        if (!cleaned.startsWith('+')) {
          if (cleaned.length === 10) {
            return `+1${cleaned}`;
          } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+${cleaned}`;
          }
        }
        // If it already has +, return as is (assuming it's valid)
        if (cleaned.startsWith('+') && cleaned.length >= 10) {
          return cleaned;
        }
        return null;
      })
      .filter((phone: string | null): phone is string => phone !== null);

    if (validPhoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'No valid phone numbers found' },
        { status: 400 }
      );
    }

    // Send SMS to each phone number
    const results = [];
    const errors = [];

    for (const phoneNumber of validPhoneNumbers) {
      try {
        const messageResult = await client.messages.create({
          body: message.trim(),
          from: fromNumber,
          to: phoneNumber,
        });

        results.push({
          phoneNumber,
          success: true,
          messageSid: messageResult.sid,
          status: messageResult.status,
        });
      } catch (error: any) {
        errors.push({
          phoneNumber,
          success: false,
          error: error.message || 'Failed to send SMS',
          code: error.code,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: validPhoneNumbers.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('SMS sending error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS messages' },
      { status: 500 }
    );
  }
}

