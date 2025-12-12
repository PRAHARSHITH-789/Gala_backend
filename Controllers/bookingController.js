const bookingModel = require("../Models/Booking");
const eventModel = require('../Models/Event');
const User = require('../Models/user');
const qrCodeGenerator = require('../utils/qrCodeGenerator');
const emailService = require('../utils/emailService');
require("dotenv").config();

const bookingController = {
  getUserBookings: async (req, res) => {
    console.log("Fetching user bookings");
    try{
      const userId = req.user._id;
      const bookings = await bookingModel.find({ user: userId })
        .populate('event')
        .sort({ createdAt: -1 });
      res.json(bookings);
    }
    catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ message: 'Error fetching bookings' });
    }
  },
  
  createBooking: async (req, res) => {
    try {
      if (req.user.role !== 'User') {
        return res.status(403).json({ message: 'Forbidden: Only regular users can create bookings' });
      }

      const { event: eventId, ticketType, ticketsBooked, pricePerTicket, totalPrice } = req.body;
      const userId = req.user._id;

      const event = await eventModel.findById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      if (event.status !== 'approved') {
        return res.status(400).json({ message: 'Event is not available for booking' });
      }

      const ticketTypeObj = event.ticketTypes.find(t => t.name === ticketType);
      if (!ticketTypeObj) {
        return res.status(404).json({ message: 'Ticket type not found' });
      }

      if (ticketTypeObj.remaining < ticketsBooked) {
        return res.status(400).json({ 
          message: `Not enough tickets available. Only ${ticketTypeObj.remaining} ${ticketType} tickets remaining` 
        });
      }

      const booking = new bookingModel({
        user: userId,
        event: eventId,
        ticketType,
        ticketsBooked,
        pricePerTicket,
        totalPrice,
        bookingStatus: 'Booked'
      });

      ticketTypeObj.remaining -= ticketsBooked;
      event.remainingTickets -= ticketsBooked;
      await event.save();
      await booking.save();

      // ✅ GENERATE QR CODE
      try {
        const qrToken = qrCodeGenerator.generateToken(booking._id, userId, eventId);
        const qrCodeImage = await qrCodeGenerator.generateQRCode(qrToken);
        
        booking.qrToken = qrToken;
        booking.qrCode = qrCodeImage;
        await booking.save();

        // ✅ SEND EMAIL
        const user = await User.findById(userId);
       
        
        console.log('✅ QR Code generated and email sent for booking:', booking._id);
      } catch (qrError) {
        console.error('⚠️ Error generating QR or sending email:', qrError);
      }
      
      await booking.populate('event');
      
      res.status(201).json({ 
        message: 'Booking confirmed successfully! Check your email for your ticket.',
        booking,
        redirect: '/my-bookings'
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({ message: 'Error creating booking', error: error.message });
    }
  },

  // ✅ NEW: Verify QR Code (for organizers)
  verifyQRCode: async (req, res) => {
    try {
      const { token } = req.params;
      const organizerId = req.user._id;

      // Verify token signature
      const verification = qrCodeGenerator.verifyToken(token);
      if (!verification.valid) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid or expired QR code' 
        });
      }

      // Find booking by token
      const booking = await bookingModel.findOne({ qrToken: token })
        .populate('event', 'title date time location organizer')
        .populate('user', 'name email');

      if (!booking) {
        return res.status(404).json({ 
          success: false,
          message: 'Booking not found' 
        });
      }

      // Check if organizer owns this event
      if (req.user.role === 'Organizer' && 
          booking.event.organizer.toString() !== organizerId.toString()) {
        return res.status(403).json({ 
          success: false,
          message: 'You are not authorized to verify this ticket' 
        });
      }

      // Check if already used
      if (booking.qrCodeUsed) {
        return res.status(400).json({ 
          success: false,
          message: 'QR code already used',
          alreadyScanned: true,
          scannedAt: booking.qrCodeScannedAt,
          booking: {
            id: booking._id,
            userName: booking.user.name,
            ticketType: booking.ticketType,
            ticketsBooked: booking.ticketsBooked
          }
        });
      }

      // Check if cancelled
      if (booking.bookingStatus === 'Cancelled') {
        return res.status(400).json({ 
          success: false,
          message: 'This booking has been cancelled',
          booking: {
            id: booking._id,
            userName: booking.user.name,
            status: booking.bookingStatus
          }
        });
      }

      // ✅ MARK AS ATTENDED
      booking.qrCodeUsed = true;
      booking.qrCodeScannedAt = new Date();
      booking.qrCodeScannedBy = organizerId;
      booking.bookingStatus = 'Attended';
      await booking.save();

      res.status(200).json({
        success: true,
        message: 'Ticket verified successfully! Entry granted.',
        booking: {
          id: booking._id,
          userName: booking.user.name,
          userEmail: booking.user.email,
          eventTitle: booking.event.title,
          ticketType: booking.ticketType,
          ticketsBooked: booking.ticketsBooked,
          totalPrice: booking.totalPrice,
          bookingDate: booking.createdAt,
          scannedAt: booking.qrCodeScannedAt
        }
      });
    } catch (error) {
      console.error('Error verifying QR code:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error verifying ticket',
        error: error.message 
      });
    }
  },

  // ✅ NEW: Get booking by QR token (for public verification page)
  getBookingByToken: async (req, res) => {
    try {
      const { token } = req.params;

      const verification = qrCodeGenerator.verifyToken(token);
      if (!verification.valid) {
        return res.status(400).json({ message: 'Invalid or expired QR code' });
      }

      const booking = await bookingModel.findOne({ qrToken: token })
        .populate('event', 'title date time location')
        .populate('user', 'name');

      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      res.status(200).json({
        booking: {
          id: booking._id,
          userName: booking.user.name,
          eventTitle: booking.event.title,
          eventDate: booking.event.date,
          eventTime: booking.event.time,
          eventLocation: booking.event.location,
          ticketType: booking.ticketType,
          ticketsBooked: booking.ticketsBooked,
          totalPrice: booking.totalPrice,
          status: booking.bookingStatus,
          qrCodeUsed: booking.qrCodeUsed,
          scannedAt: booking.qrCodeScannedAt
        }
      });
    } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).json({ message: 'Error fetching booking details' });
    }
  },
  
  cancelBooking: async (req, res) => {
    try {
      const bookingId = req.params.id;
      const userId = req.user._id;

      const booking = await bookingModel.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.user.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Not authorized to cancel this booking" });
      }

      if (booking.bookingStatus === 'Cancelled') {
        return res.status(400).json({ message: "Booking is already cancelled" });
      }

      const event = await eventModel.findById(booking.event);
      if (event) {
        const ticketTypeObj = event.ticketTypes.find(t => t.name === booking.ticketType);
        if (ticketTypeObj) {
          ticketTypeObj.remaining += booking.ticketsBooked;
        }
        event.remainingTickets += booking.ticketsBooked;
        await event.save();
      }

      booking.bookingStatus = 'Cancelled';
      await booking.save();
      
      res.status(200).json({ message: "Booking cancelled successfully", booking });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ message: "Error cancelling booking", error: error.message });
    }
  },

  markAsAttended: async (req, res) => {
    try {
      const bookingId = req.params.id;
      const userId = req.user._id;

      const booking = await bookingModel.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.user.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Not authorized" });
      }

      if (booking.bookingStatus === 'Cancelled') {
        return res.status(400).json({ message: "Cannot mark cancelled booking as attended" });
      }

      booking.bookingStatus = 'Attended';
      await booking.save();

      res.status(200).json({ message: "Booking marked as attended", booking });
    } catch (error) {
      console.error("Error marking booking as attended:", error);
      res.status(500).json({ message: "Error updating booking" });
    }
  },

  getBookingById: async (req, res) => {
    try {
      const booking = await bookingModel.findById(req.params.id)
        .populate('event', 'title date location')
        .populate('user', 'name email');
      
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (booking.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this booking' });
      }

      res.json(booking);
    } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).json({ message: 'Error fetching booking' });
    }
  },
};

module.exports = bookingController;