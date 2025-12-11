const userModel = require('../Models/user');
const eventModel = require("../Models/Event");
const Booking = require('../Models/Booking');
const organizerModel = require('../Models/Organizer');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend("re_BPvPMXhx_Mpsa9YFmjv4T5jdCi2KimgfJ");

const secretKey = process.env.secretkey;

// Storage for OTPs
const otpStore = new Map(); // For forgot password
const pendingRegistrations = new Map(); // For registration

// Clean up expired registrations every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean forgot password OTPs
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
      console.log('🧹 Cleaned expired forgot password OTP for:', email);
    }
  }
  
  // Clean pending registrations
  for (const [email, data] of pendingRegistrations.entries()) {
    if (now > data.expiresAt) {
      pendingRegistrations.delete(email);
      console.log('🧹 Cleaned expired registration for:', email);
    }
  }
}, 5 * 60 * 1000);

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Email configuration (Render-friendly: uses explicit SMTP host/port and env vars)
const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const emailPort = Number(process.env.EMAIL_PORT || 587);
const emailUser = process.env.EMAIL_USER || 'siddhu.vakkapatla@gmail.com';
const emailPass = process.env.EMAIL_PASS || 'xuxg bdif npib ebaj';
const emailFrom = process.env.EMAIL_FROM || `"EventHub" <${emailUser}>`;
const emailSecure = process.env.EMAIL_SECURE
  ? process.env.EMAIL_SECURE === 'true'
  : emailPort === 465; // true for port 465, false for 587

// const transporter = nodemailer.createTransport({
//   host: emailHost,
//   port: emailPort,
//   secure: emailSecure,
//   auth: {
//     user: emailUser,
//     pass: emailPass,
//   },
// });

// Log SMTP readiness once on boot (useful on Render)
// transporter.verify()
//   .then(() => console.log(`✅ SMTP server ready at ${emailHost}:${emailPort} (secure=${emailSecure})`))
//   .catch((err) => console.error('❌ SMTP connection failed:', err.message));

// Send forgot password OTP email
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: emailFrom,
    to: email,
    subject: "EventHub - Password Reset OTP",
    text: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Your OTP code is:</p>
        <div style="background: #667eea; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #f39c12;">⏰ This code expires in <strong>5 minutes</strong></p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `
  };

  // const info = await transporter.sendMail(mailOptions);
  // console.log('✅ Forgot password OTP sent to:', email);
  // return info;
};

// Send registration OTP email with better logging
// const sendRegistrationOTPEmail = async (email, otp, name) => {
//    console.log('📧 Preparing to send registration OTP email...');
//   console.log('📧 To:', email);
//   console.log('🔢 OTP:', otp);
//   console.log('👤 Name:', name);

//   const mailOptions = {
//     from: emailFrom,
//     to: email,
//     subject: `EventHub - Email Verification Code: ${otp}`,
//     text: `
// Hi ${name},

// Welcome to EventHub!

// Your verification code is: ${otp}

// This code will expire in 10 minutes.

// If you didn't request this, please ignore this email.

// Best regards,
// EventHub Team
//     `,
//     html: `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       </head>
//       <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
//         <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 50px 0;">
//           <tr>
//             <td align="center">
//               <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
//                 <!-- Header -->
//                 <tr>
//                   <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
//                     <h1 style="margin: 0; font-size: 28px; color: #ffffff;">🎉 Welcome to EventHub!</h1>
//                   </td>
//                 </tr>
                
//                 <!-- Content -->
//                 <tr>
//                   <td style="padding: 40px 30px; text-align: center;">
//                     <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 20px 0;">
//                       Hi <strong>${name}</strong>,
//                     </p>
//                     <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 20px 0;">
//                       Thank you for signing up! Please verify your email address using this OTP:
//                     </p>
                    
//                     <!-- OTP Box - FIXED COLORS -->
//                     <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
//                       ${otp}
//                     </div>
                    
//                     <!-- Warning Box -->
//                     <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; text-align: left;">
//                       <p style="margin: 0; color: #856404;">
//                         ⏰ <strong>Important:</strong> This OTP expires in 10 minutes.
//                       </p>
//                     </div>
                    
//                     <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 20px 0;">
//                       If you didn't request this, please ignore this email.
//                     </p>
//                   </td>
//                 </tr>
                
//                 <!-- Footer -->
//                 <tr>
//                   <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
//                     <p style="margin: 0; color: #6c757d; font-size: 14px;">
//                       EventHub - Your Gateway to Amazing Events
//                     </p>
//                     <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">
//                       © ${new Date().getFullYear()} EventHub. All rights reserved.
//                     </p>
//                   </td>
//                 </tr>
                
//               </table>
//             </td>
//           </tr>
//         </table>
//       </body>
//       </html>
//     `
//   };

//   // try {
//   //   const info = await transporter.sendMail(mailOptions);
//   //   console.log('✅ Registration OTP email sent successfully!');
//   //   console.log('📬 Message ID:', info.messageId);
//   //   console.log('📧 Accepted:', info.accepted);
//   //   return info;
//   // } catch (error) {
//   //   console.error('❌ Failed to send registration OTP email:', error);
//   //   throw error;
//   // }
// };
const sendRegistrationOTPEmail = async (email, otp, name) => {
  try {
    const data = await resend.emails.send({
      from: "EventHub <noreply@yourdomain.com>",
      to: email,
      subject: `Your OTP Code: ${otp}`,
      html: `
        <h2>Hello ${name},</h2>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>It expires in 10 minutes.</p>
      `,
    });

    console.log("📨 OTP sent to:", email);
    return data;
  } catch (err) {
    console.error("❌ Email sending error:", err);
    throw err;
  }
};


// Multer configuration for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/profiles/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// ==================== USER CONTROLLER ====================
const userController = {
  // ==================== REGISTRATION WITH OTP ====================
  
  // Send OTP for registration
  sendRegistrationOTP: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      console.log('\n📝 === Registration OTP Request ===');
      console.log('Name:', name);
      console.log('Email:', email);
      console.log('Role:', role || 'User');

      // Validation
      if (!name || !email || !password) {
        console.log('❌ Validation failed: Missing required fields');
        return res.status(400).json({ message: 'Name, email, and password are required' });
      }

      // Check if user exists
      const existingUser = await userModel.findOne({ email });
      if (existingUser) {
        console.log('❌ User already exists:', email);
        return res.status(409).json({ message: 'Email already registered' });
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.log('❌ Invalid email format:', email);
        return res.status(400).json({ message: 'Invalid email format' });
      }

      // Validate password
      if (password.length < 6) {
        console.log('❌ Password too short');
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      // Generate OTP
      const otp = generateOTP();
      console.log('🔢 Generated OTP:', otp);

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('🔒 Password hashed successfully');

      // Store temporarily (10 minutes)
      const registrationData = {
        name,
        email,
        password: hashedPassword,
        role: role || 'User',
        otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000
      };
      
      pendingRegistrations.set(email, registrationData);
      console.log('💾 Stored pending registration. Total pending:', pendingRegistrations.size);

      // Send OTP email
      try {
        await sendRegistrationOTPEmail(email, otp, name);
        console.log('✅ Registration OTP process completed successfully\n');
        
        res.status(200).json({ 
          success: true,
          message: 'OTP sent to your email',
          email,
          // Include OTP in development mode for testing
          ...(process.env.NODE_ENV === 'development' && { debug_otp: otp })
        });
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError);
        pendingRegistrations.delete(email);
        return res.status(500).json({ 
          message: 'Failed to send OTP email. Please try again.',
          error: emailError.message 
        });
      }

    } catch (error) {
      console.error('❌ Send registration OTP error:', error);
      res.status(500).json({ 
        message: 'Failed to send OTP',
        error: error.message 
      });
    }
  },

  // Verify OTP and complete registration
  verifyRegistrationOTP: async (req, res) => {
    try {
      const { email, otp } = req.body;

      console.log('\n🔍 === Verifying Registration OTP ===');
      console.log('Email:', email);
      console.log('OTP received:', otp);

      if (!email || !otp) {
        console.log('❌ Missing email or OTP');
        return res.status(400).json({ message: 'Email and OTP are required' });
      }

      const pendingReg = pendingRegistrations.get(email);

      if (!pendingReg) {
        console.log('❌ No pending registration found for:', email);
        console.log('Current pending registrations:', Array.from(pendingRegistrations.keys()));
        return res.status(400).json({ message: 'No pending registration found. Please register again.' });
      }

      console.log('✅ Found pending registration');
      console.log('Stored OTP:', pendingReg.otp);

      // Check expiry
      if (Date.now() > pendingReg.expiresAt) {
        console.log('❌ OTP expired');
        pendingRegistrations.delete(email);
        return res.status(400).json({ message: 'OTP expired. Please register again.' });
      }

      // Verify OTP
      if (pendingReg.otp !== otp) {
        console.log('❌ Invalid OTP. Expected:', pendingReg.otp, 'Got:', otp);
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      console.log('✅ OTP verified successfully');

      // Create user
      const { name, password, role } = pendingReg;

      const newUser = new userModel({
        name,
        email,
        password,
        role
      });

      await newUser.save();
      console.log('✅ User created successfully:', newUser._id);
      
      pendingRegistrations.delete(email);
      console.log('🧹 Cleaned up pending registration');

      // Generate token
      const currentDateTime = new Date();
      const expiresAt = new Date(+currentDateTime + 180000000);
      
      const token = jwt.sign(
        { user: { _id: newUser._id, role: newUser.role } },
        secretKey,
        { expiresIn: 3 * 60000 }
      );

      console.log('🔑 Token generated');
      console.log('✅ Registration process completed\n');

      return res
        .cookie("token", token, {
          expires: expiresAt,
          httpOnly: true,
          secure: false,
          sameSite: "lax",
        })
        .status(201)
        .json({
          success: true,
          message: 'Registration successful!',
          user: {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            profilePicture: newUser.profilePicture
          }
        });

    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      res.status(500).json({ 
        message: 'Failed to verify OTP',
        error: error.message 
      });
    }
  },

  // Resend registration OTP
  resendRegistrationOTP: async (req, res) => {
    try {
      const { email } = req.body;

      console.log('\n🔄 === Resending Registration OTP ===');
      console.log('Email:', email);

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const pendingReg = pendingRegistrations.get(email);

      if (!pendingReg) {
        console.log('❌ No pending registration found');
        return res.status(400).json({ message: 'No pending registration found' });
      }

      // Generate new OTP
      const newOTP = generateOTP();
      console.log('🔢 New OTP generated:', newOTP);
      
      // Update stored data
      pendingReg.otp = newOTP;
      pendingReg.expiresAt = Date.now() + 10 * 60 * 1000;
      pendingRegistrations.set(email, pendingReg);

      // Send new OTP
      await sendRegistrationOTPEmail(email, newOTP, pendingReg.name);
      console.log('✅ OTP resent successfully\n');

      res.status(200).json({ 
        success: true,
        message: 'New OTP sent to your email',
        ...(process.env.NODE_ENV === 'development' && { debug_otp: newOTP })
      });

    } catch (error) {
      console.error('❌ Resend OTP error:', error);
      res.status(500).json({ 
        message: 'Failed to resend OTP',
        error: error.message 
      });
    }
  },

  // ==================== LOGIN ====================
  // ==================== LOGIN ====================
login: async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(404).json({ message: "Email not found" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('❌ Incorrect password for:', email);
      return res.status(401).json({ message: "Incorrect password" });
    }

    console.log('✅ Password verified for:', email);

    // Generate token
    const currentDateTime = new Date();
    const expiresAt = new Date(+currentDateTime + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const token = jwt.sign(
      { user: { _id: user._id, role: user.role } },
      secretKey,
      { expiresIn: '7d' }
    );

    console.log('🔑 Token generated');

    // ✅ FIX: Return user WITHOUT password
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture || 'default.jpg'
    };

    console.log('✅ Login successful for:', email);

return res
  .cookie("token", token, {
    expires: expiresAt,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // ✅ Only secure in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
  })
  .status(200)
  .json({ 
    success: true,
    message: "Login successfully", 
    user: userResponse
  });
  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
},

  // ==================== FORGOT PASSWORD ====================
  forgotPassword: async (req, res) => {
    try {
      const { email, newPassword, otp } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required." });
      }

      const user = await userModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Step 1: Send OTP
      if (!otp && newPassword) {
        const code = generateOTP();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const expiresAt = Date.now() + 5 * 60 * 1000;

        otpStore.set(email, { otp: code, hashedPassword, expiresAt });

        await sendOTPEmail(email, code);
        return res.status(200).json({ message: "OTP sent to email." });
      }

      // Step 2: Verify OTP
      const record = otpStore.get(email);
      if (!record) {
        return res.status(400).json({ message: "No OTP request found." });
      }

      if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ message: "OTP expired." });
      }

      if (otp !== record.otp) {
        return res.status(400).json({ message: "Invalid OTP." });
      }

      user.password = record.hashedPassword;
      await user.save();
      otpStore.delete(email);

      return res.status(200).json({ message: "Password successfully reset." });
    } catch (error) {
      console.error("Forgot Password Error:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  },

  // ==================== PROFILE PICTURE ====================
  uploadProfilePicture: upload.single('profilePicture'),

  updateProfilePicture: async (req, res) => {
    try {
      const userId = req.user._id;

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete old profile picture if it exists
      if (user.profilePicture && user.profilePicture !== 'default.jpg') {
        const oldImagePath = path.join(__dirname, '..', user.profilePicture);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Update user with new profile picture
      const profilePicturePath = `uploads/profiles/${req.file.filename}`;
      user.profilePicture = profilePicturePath;
      await user.save();

      res.status(200).json({
        message: 'Profile picture updated successfully',
        profilePicture: profilePicturePath,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture
        }
      });
    } catch (error) {
      console.error('Error updating profile picture:', error);
      res.status(500).json({ 
        message: 'Error updating profile picture',
        error: error.message 
      });
    }
  },

  deleteProfilePicture: async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await userModel.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete file if exists
      if (user.profilePicture && user.profilePicture !== 'default.jpg') {
        const imagePath = path.join(__dirname, '..', user.profilePicture);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      user.profilePicture = 'default.jpg';
      await user.save();

      res.status(200).json({
        message: 'Profile picture deleted successfully',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture
        }
      });
    } catch (error) {
      console.error('Error deleting profile picture:', error);
      res.status(500).json({ 
        message: 'Error deleting profile picture',
        error: error.message 
      });
    }
  },

  // ==================== USER MANAGEMENT ====================
  getAllUsers: async (req, res) => {
    try {
      const users = await userModel.find().select('-password');
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },

  getUserById: async (req, res) => {
    try {
      const user = await userModel.findById(req.params.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(200).json(user);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },

  getUserProfile: async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await userModel.findById(userId).select('-password');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error("Error in getUserProfile:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // User updates their own profile
  updateUser: async (req, res) => {
    try {
      const userId = req.user._id;
      const { name, email, currentPassword, newPassword } = req.body;

      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update basic info
      if (name) user.name = name;
      if (email) user.email = email;

      // Update password if provided
      if (currentPassword && newPassword) {
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
        user.password = await bcrypt.hash(newPassword, 10);
      }

      await user.save();

      const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture
      };

      return res.status(200).json({ 
        message: "User updated successfully",
        user: userResponse 
      });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ message: error.message });
    }
  },

  // Admin updates any user
  adminUpdateUser: async (req, res) => {
    try {
      const userId = req.params.id;
      
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const allowedFields = ["name", "email", "role"];
      const updateData = {};
      
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      if (req.body.password) {
        const hashPassword = await bcrypt.hash(req.body.password, 10);
        updateData.password = hashPassword;
      }

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).select('-password');

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({ 
        message: "User updated successfully", 
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user", error: error.message });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await userModel.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete profile picture if exists
      if (user.profilePicture && user.profilePicture !== 'default.jpg') {
        const imagePath = path.join(__dirname, '..', user.profilePicture);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      await userModel.findByIdAndDelete(userId);
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  updateRole: async (req, res) => {
    try {
      const newRole = req.body.role;

      if (!newRole) {
        return res.status(400).json({ message: "Empty role" });
      }

      const user = await userModel.findByIdAndUpdate(
        req.params.id,
        { role: newRole },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({ message: "Role Updated Successfully", user });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  createUser: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      
      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existingUser = await userModel.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }

      const hashPassword = await bcrypt.hash(password, 10);

      const newUser = new userModel({
        name,
        email,
        password: hashPassword,
        role,
      });

      await newUser.save();
      
      const { password: _, ...userWithoutPassword } = newUser.toObject();
      
      res.status(201).json({ 
        message: "User created successfully", 
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  },

  // ==================== ORGANIZER SPECIFIC ====================
  getUserEvents: async (req, res) => {
    try {
      const userID = req.user._id;
      const events = await eventModel.find({ organizer: userID });
      
      if (events.length === 0) {
        return res.status(200).json({ 
          success: true,
          events: [],
          message: "No events found for the user" 
        });
      }
      
      return res.status(200).json({ 
        success: true,
        events 
      });
    } catch (error) {
      console.error("Error getting user events:", error);
      return res.status(500).json({ message: "Error getting events: " + error.message });
    }
  },

  getEventAnalytics: async (req, res) => {
    try {
      const organizerId = req.user._id;

      const events = await eventModel.find({ organizer: organizerId });
      const eventIds = events.map(e => e._id);

      const bookings = await Booking.find({ 
        event: { $in: eventIds },
        bookingStatus: { $ne: 'Cancelled' }
      });

      const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).length;

      // Build event breakdown
      const eventBreakdown = events.map(event => {
        const eventBookings = bookings.filter(b => b.event.toString() === event._id.toString());
        const eventRevenue = eventBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
        const ticketsSold = eventBookings.reduce((sum, b) => sum + (b.ticketsBooked || 0), 0);
        
        return {
          eventId: event._id,
          eventTitle: event.title,
          totalBookings: eventBookings.length,
          revenue: eventRevenue,
          ticketsSold: ticketsSold,
          totalTickets: event.totalTickets || 0,
          percentageBooked: event.totalTickets > 0 
            ? Math.round((ticketsSold / event.totalTickets) * 100) 
            : 0
        };
      });

      const analytics = {
        totalEvents: events.length,
        totalBookings: bookings.length,
        totalRevenue: totalRevenue,
        upcomingEvents: upcomingEvents,
        eventBreakdown: eventBreakdown
      };

      res.status(200).json({ 
        success: true,
        analytics 
      });

    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch analytics',
        details: error.message 
      });
    }
  }
};

module.exports = userController;