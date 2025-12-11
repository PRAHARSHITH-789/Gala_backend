const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require('path');
require('dotenv').config();

const User = require("./Models/user");
const app = express();
const userRoutes = require("./Routes/user");
const eventRoutes = require("./Routes/event");
const authRoutes = require("./Routes/auth");
const bookingRoutes = require("./Routes/booking");
const authenticationMiddleware = require('./Middleware/authenticationMiddleware');
const authrizationMiddleware = require("./Middleware/authorizationMiddleware");
const contactRoutes = require('./Routes/contact');
const chatbotRoutes = require('./Routes/chatbot');

// Middleware
app.use(express.json({ limit: "10mb" }));         // for JSON payloads
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(cookieParser());

app.use(cors({
  origin: "http://localhost:5173",   // Your frontend URL
  credentials: true,                 // Allow cookies / credentials
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// PUBLIC ROUTES (No authentication required)
app.use("/api/v1", authRoutes);

// PUBLIC EVENT ROUTES - Move this BEFORE authentication middleware
app.get("/api/v1/events", async (req, res, next) => {
  const eventController = require("./Controllers/eventController");
  return eventController.getApprovedEvents(req, res);
});
app.use('/api/v1/contact', contactRoutes);

// PROTECTED ROUTES (Authentication required)
app.use(authenticationMiddleware);

app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/bookings", bookingRoutes); // Other event routes (create, update, delete)
app.use("/api/v1/users", userRoutes);
app.use('/api/v1/chatbot', chatbotRoutes);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((e) => {
    console.log(e);
  });

app.use(function (req, res, next) {
  return res.status(404).send("404");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(process.env.PORT || 3000, () => console.log(`Server started on port ${process.env.PORT || 3000}`));

module.exports = app;
