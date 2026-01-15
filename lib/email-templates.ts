// Shared email templates for the application

export function getWelcomeEmailContent(fullName: string, email: string, password: string) {
  const emailContent = `
Welcome ${fullName},

Glad to have your interest, please be sure to follow the following steps in the account.

Your username is: ${email}
Your password is: ${password}

1. Upload your best pictures you want to see on your website.

2. Upload info pertaining to your website. Pamphlets etc... The more info and menu prices the better.

3. Fill in all the info for account settings.

After that you will have a fully custom site up and running in less than 24 hours.
    `;

  const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background: #000000; background-image: radial-gradient(circle at 20% 50%, rgba(34, 211, 238, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.03) 0%, transparent 50%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: transparent; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%); border: 2px solid rgba(34, 211, 238, 0.3); border-radius: 0; box-shadow: 0 0 30px rgba(34, 211, 238, 0.2), inset 0 0 30px rgba(34, 211, 238, 0.05); overflow: hidden; position: relative;">
                      <!-- Tech Pattern Overlay -->
                      <tr>
                        <td style="position: relative; padding: 0;">
                          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34, 211, 238, 0.03) 2px, rgba(34, 211, 238, 0.03) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(34, 211, 238, 0.03) 2px, rgba(34, 211, 238, 0.03) 4px); pointer-events: none;"></div>
                        </td>
                      </tr>
                      
                      <!-- Header -->
                      <tr>
                        <td style="padding: 50px 40px 40px; text-align: center; border-bottom: 2px solid rgba(34, 211, 238, 0.3); position: relative;">
                          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #22d3ee, transparent);"></div>
                          <h1 style="margin: 0; font-size: 42px; font-weight: 900; background: linear-gradient(135deg, #22d3ee 0%, #3b82f6 50%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -1px; text-shadow: 0 0 30px rgba(34, 211, 238, 0.5); position: relative;">
                            Welcome ${fullName},
                          </h1>
                          <div style="margin-top: 15px; width: 60px; height: 3px; background: linear-gradient(90deg, transparent, #22d3ee, transparent); margin-left: auto; margin-right: auto;"></div>
                        </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                        <td style="padding: 45px 40px; position: relative;">
                          <p style="margin: 0 0 35px 0; color: #e5e7eb; font-size: 22px; line-height: 2; font-weight: 400; letter-spacing: 0.3px;">
                            Glad to have your interest, please be sure to follow the following steps in the account.
                          </p>
                          
                          <!-- Credentials Box - Tech Style -->
                          <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%); border: 2px solid rgba(34, 211, 238, 0.4); border-radius: 0; padding: 35px; margin: 40px 0; box-shadow: 0 0 20px rgba(34, 211, 238, 0.15), inset 0 0 20px rgba(34, 211, 238, 0.05); position: relative; overflow: hidden;">
                            <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #22d3ee, #3b82f6);"></div>
                            <p style="margin: 0 0 30px 0; color: #22d3ee; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);">ACCOUNT DETAILS</p>
                            <div style="border-top: 1px solid rgba(34, 211, 238, 0.2); padding-top: 25px; margin-top: 25px;">
                              <p style="margin: 22px 0; color: #f3f4f6; font-size: 20px; line-height: 1.8; font-family: 'Courier New', monospace;">
                                <span style="color: #9ca3af; font-weight: 600; margin-right: 12px;">USERNAME:</span>
                                <span style="color: #ffffff; font-weight: 500; letter-spacing: 0.5px;">${email}</span>
                              </p>
                              <p style="margin: 22px 0; color: #f3f4f6; font-size: 20px; line-height: 1.8; font-family: 'Courier New', monospace;">
                                <span style="color: #9ca3af; font-weight: 600; margin-right: 12px;">PASSWORD:</span>
                                <span style="color: #ffffff; font-weight: 500; letter-spacing: 0.5px;">${password}</span>
                              </p>
                            </div>
                          </div>

                          <!-- Steps - Tech Style -->
                          <div style="margin: 45px 0;">
                            <p style="margin: 0 0 30px 0; color: #22d3ee; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);">INSTRUCTIONS</p>
                            <div style="margin: 0; padding-left: 0;">
                              <div style="margin-bottom: 30px; color: #f3f4f6; font-size: 21px; line-height: 2; padding-left: 50px; position: relative;">
                                <span style="position: absolute; left: 0; top: 0; width: 35px; height: 35px; background: linear-gradient(135deg, #22d3ee, #3b82f6); border: 2px solid rgba(34, 211, 238, 0.5); display: table-cell; vertical-align: middle; text-align: center; font-weight: 700; font-size: 16px; color: #000; box-shadow: 0 0 15px rgba(34, 211, 238, 0.4); line-height: 35px;">1</span>
                                Upload your best pictures you want to see on your website.
                              </div>
                              <div style="margin-bottom: 30px; color: #f3f4f6; font-size: 21px; line-height: 2; padding-left: 50px; position: relative;">
                                <span style="position: absolute; left: 0; top: 0; width: 35px; height: 35px; background: linear-gradient(135deg, #22d3ee, #3b82f6); border: 2px solid rgba(34, 211, 238, 0.5); display: table-cell; vertical-align: middle; text-align: center; font-weight: 700; font-size: 16px; color: #000; box-shadow: 0 0 15px rgba(34, 211, 238, 0.4); line-height: 35px;">2</span>
                                Upload info pertaining to your website. Pamphlets etc... The more info and menu prices the better.
                              </div>
                              <div style="margin-bottom: 30px; color: #f3f4f6; font-size: 21px; line-height: 2; padding-left: 50px; position: relative;">
                                <span style="position: absolute; left: 0; top: 0; width: 35px; height: 35px; background: linear-gradient(135deg, #22d3ee, #3b82f6); border: 2px solid rgba(34, 211, 238, 0.5); display: table-cell; vertical-align: middle; text-align: center; font-weight: 700; font-size: 16px; color: #000; box-shadow: 0 0 15px rgba(34, 211, 238, 0.4); line-height: 35px;">3</span>
                                Fill in all the info for account settings.
                              </div>
                            </div>
                          </div>

                          <!-- Final Message - Plain Text -->
                          <p style="margin: 45px 0 0 0; color: #f3f4f6; font-size: 22px; line-height: 2; font-weight: 400;">
                            After that you will have a fully custom site up and running in less than 24 hours.
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 35px 40px; text-align: center; border-top: 2px solid rgba(34, 211, 238, 0.3); position: relative;">
                          <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #22d3ee, transparent);"></div>
                          <p style="margin: 0; color: #9ca3af; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">
                            AI Web Design Firm
                          </p>
                          <div style="margin-top: 15px; width: 40px; height: 2px; background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.5), transparent); margin-left: auto; margin-right: auto;"></div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
    `;

  return { emailContent, htmlContent };
}

