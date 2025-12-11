const nodemailer = require('nodemailer');

// Create transporter using your Gmail config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "siddhu.vakkapatla@gmail.com",
    pass: "wtop oupy byia ceif",
  },
});

const emailService = {
  // Send booking confirmation email with QR code
  sendBookingConfirmation: async (booking, user, event, qrCodeImage) => {
    try {
      const eventDate = new Date(event.date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const mailOptions = {
        from: "siddhu.vakkapatla@gmail.com",
        to: user.email,
        subject: `🎫 Booking Confirmed - ${event.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
              }
              .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 40px 30px; 
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
              }
              .header p {
                margin: 10px 0 0 0;
                font-size: 16px;
                opacity: 0.9;
              }
              .content { 
                padding: 40px 30px;
                background-color: #f9f9f9;
              }
              .greeting {
                font-size: 18px;
                margin-bottom: 20px;
                color: #333;
              }
              .ticket { 
                background: white; 
                padding: 25px; 
                border-radius: 10px; 
                margin: 25px 0; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.08);
              }
              .ticket h2 {
                color: #667eea;
                margin: 0 0 20px 0;
                font-size: 24px;
                text-align: center;
              }
              .details { 
                margin: 20px 0;
                line-height: 1.8;
              }
              .details p {
                margin: 10px 0;
                font-size: 15px;
              }
              .details strong { 
                color: #667eea;
                display: inline-block;
                min-width: 120px;
              }
              
              /* ✅ QR CODE SECTION - CENTERED WITH CID */
              .qr-code { 
                text-align: center; 
                margin: 30px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
              }
              .qr-code p.title {
                margin: 0 0 15px 0;
                font-size: 18px;
                font-weight: bold;
                color: #667eea;
              }
              .qr-code img { 
                max-width: 280px !important;
                width: 280px !important;
                height: auto !important;
                border: 4px solid #667eea; 
                border-radius: 12px; 
                padding: 15px; 
                background: white;
                display: block !important;
                margin: 0 auto !important;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
              }
              .qr-note {
                color: #666; 
                font-size: 13px;
                margin-top: 15px;
                font-style: italic;
              }
              
              .important-notes {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 20px;
                margin: 25px 0;
                border-radius: 5px;
              }
              .important-notes h3 {
                margin: 0 0 15px 0;
                color: #856404;
                font-size: 18px;
              }
              .important-notes ul {
                margin: 0;
                padding-left: 20px;
              }
              .important-notes li {
                margin: 8px 0;
                color: #856404;
              }
              
              .button-container {
                text-align: center;
                margin: 30px 0;
              }
              .button { 
                display: inline-block; 
                background: #667eea; 
                color: white !important; 
                padding: 14px 35px; 
                text-decoration: none; 
                border-radius: 6px; 
                font-weight: bold;
                font-size: 16px;
                box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
              }
              
              .footer { 
                text-align: center; 
                color: #666; 
                font-size: 13px; 
                padding: 30px;
                background-color: #f9f9f9;
                border-top: 1px solid #e0e0e0;
              }
              .footer p {
                margin: 5px 0;
              }
              
              @media only screen and (max-width: 600px) {
                .container {
                  margin: 0;
                  border-radius: 0;
                }
                .content {
                  padding: 20px 15px;
                }
                .qr-code img {
                  max-width: 220px !important;
                  width: 220px !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <!-- Header -->
              <div class="header">
                <h1>🎉 Booking Confirmed!</h1>
                <p>Your ticket is ready</p>
              </div>
              
              <!-- Content -->
              <div class="content">
                <p class="greeting">Hi <strong>${user.name}</strong>,</p>
                <p>Thank you for your booking! Here are your ticket details:</p>
                
                <!-- Ticket Card -->
                <div class="ticket">
                  <h2>${event.title}</h2>
                  
                  <!-- Event Details -->
                  <div class="details">
                    <p><strong>📅 Date:</strong> ${eventDate}</p>
                    <p><strong>🕐 Time:</strong> ${event.time}</p>
                    <p><strong>📍 Location:</strong> ${event.location}</p>
                    <p><strong>🎫 Ticket Type:</strong> ${booking.ticketType}</p>
                    <p><strong>🔢 Quantity:</strong> ${booking.ticketsBooked} ticket(s)</p>
                    <p><strong>💰 Total Paid:</strong> $${booking.totalPrice}</p>
                    <p><strong>🆔 Booking ID:</strong> ${booking._id}</p>
                  </div>
                  
                  <!-- ✅ QR CODE - USING CID (Content-ID) -->
                  <div class="qr-code">
                    <p class="title">Your Entry QR Code:</p>
                    <img src="cid:qrcode" alt="QR Code" style="display: block; margin: 0 auto; max-width: 280px; width: 280px;" />
                    <p class="qr-note">Show this QR code at the venue entrance</p>
                  </div>
                </div>
                
                <!-- Important Notes -->
                <div class="important-notes">
                  <h3>⚠️ Important Notes:</h3>
                  <ul>
                    <li>This QR code is unique to your booking</li>
                    <li>It can only be scanned <strong>once</strong> for entry</li>
                    <li>Please arrive <strong>15 minutes</strong> before the event starts</li>
                    <li>Keep this email for your records</li>
                  </ul>
                </div>
                
                <!-- Button -->
                <div class="button-container">
                  <a href="http://localhost:5173/my-bookings" class="button">View My Bookings</a>
                </div>
              </div>
              
              <!-- Footer -->
              <div class="footer">
                <p>Need help? Contact us at <strong>noorjjj2006@gmail.com</strong></p>
                <p>&copy; ${new Date().getFullYear()} EventHub. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        
        // ✅ ATTACH QR CODE WITH CONTENT-ID
        attachments: [
          {
            filename: 'qr-code.png',
            content: qrCodeImage.split('base64,')[1], // Remove data:image/png;base64, prefix
            encoding: 'base64',
            cid: 'qrcode' // ✅ This matches src="cid:qrcode" in HTML
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      console.log('✅ Email sent to:', user.email);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = emailService;