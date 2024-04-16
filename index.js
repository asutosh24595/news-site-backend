const express = require("express");
const mongoose = require("mongoose");
const User = require("./models/userSchema");
const cors = require("cors");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");
const session = require("express-session");

const app = express();

mongoose
  .connect("mongodb://127.0.0.1:27017/newsDb")
  .then(() => {
    console.log("DATABASE CONNECTION OPEN");
  })
  .catch((err) => {
    console.log("ERROR CONNECTING TO DATABASE:", err);
  });

app.use(cors());
app.use(express.json());

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// Temporary storage for OTP
const otpStorage = {};

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "asutoshshukla951@gmail.com",
    pass: "auav vptp xebq wslg",
  },
});

app.post("/login", async (req, res) => {
  try {
    const { email } = req.body;

    console.log(email);
    const existingUser = await User.findOne({ email });

    console.log(existingUser);

    if (!existingUser) {
      console.log("User Not Found");
      return res.status(400).json({ message: "User not found" });
    }

    const otp = otpGenerator.generate(6);
    otpStorage[email] = { value: otp, timestamp: Date.now() };
    const mailOptions = {
      from: "asutoshshukla951@gmail.com",
      to: email,
      subject: "Your OTP for Login",
      text: `Your OTP for login is: ${otp}. Please use this OTP to log in.`,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        return res.status(500).send("Error sending OTP");
      } else {
        console.log("Email sent: " + info.response);
      }
    });

    req.session.email = email; // Store email in session
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Error logging in");
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    console.log("InServer", firstName);
    console.log("InServer", lastName);
    console.log("InServer", email);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6);

    // Store OTP in temporary storage
    otpStorage[email] = { value: otp, timestamp: Date.now() };

    console.log(otp);
    console.log(otpStorage);

    // Create email message
    const mailOptions = {
      from: "asutoshshukla951@gmail.com",
      to: email,
      subject: "Your OTP for Signup",
      text: `Your OTP for signup is: ${otp}. Please use this OTP to complete your signup process.`,
    };

    // Send email with OTP
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        return res.status(500).send("Error sending OTP");
      } else {
        console.log("Email sent: " + info.response);
      }
    });

    res.status(201).send("OTP sent successfully");
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send("Error sending OTP");
  }
});

// Endpoint to verify OTP
app.post("/verifyotp", async (req, res) => {
  try {
    const { email, otp, firstName, lastName } = req.body;

    console.log("Email:", email);
    console.log(otp);

    // Retrieve OTP and its creation timestamp from temporary storage
    const storedOTP = otpStorage[email];

    console.log(storedOTP);

    if (!storedOTP || storedOTP.value !== otp) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    // Check if OTP has expired (5 minutes)
    const currentTime = Date.now();
    const otpCreationTime = storedOTP.timestamp;
    const otpExpirationTime = otpCreationTime + 5 * 60 * 1000; // 5 minutes

    if (currentTime > otpExpirationTime) {
      delete otpStorage[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    // If firstName and lastName are provided, treat it as a signup process
    if (firstName && lastName) {
      const newUser = new User({ firstName, lastName, email });
      await newUser.save();
      delete otpStorage[email];
      return res.status(200).json({ message: "Signup successful" });
    } else {
      // If firstName and lastName are not provided, treat it as a login process
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        delete otpStorage[email];
        return res.status(200).json({ message: "Login successful, please wait." });
      } else {
        return res
          .status(400)
          .json({ message: "User not found. Please sign up instead." });
      }
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).send("Error verifying OTP");
  }
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
