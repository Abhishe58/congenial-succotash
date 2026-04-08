const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const bcrypt = require("bcrypt");
const jsonwebtoken = require("jsonwebtoken");
const cors = require("cors");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { User, Doctor, Appointment } = require("./database/db");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "https://hospitalappointnnent.netlify.app",
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  }),
);

const port = process.env.PORT || 5000;

const myJWT = process.env.JWT_SECRET;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const autiMiddleware = (req, res, next) => {
  const header = req.headers.authorization;

  console.log("HEADER:", header); // 👈 ADD THIS

  if (!header) {
    return res.status(401).json({ message: "No token" });
  }

  const token = header.split(" ")[1];

  console.log("TOKEN:"); // 👈 ADD THIS

  try {
    const decoded = jsonwebtoken.verify(token, myJWT);

    console.log("DECODED:", decoded); // 👈 ADD THIS

    req.user = decoded;
    next();
  } catch (error) {
    console.log("JWT ERROR:", error.message); // 👈 IMPORTANT
    return res.status(401).json({ message: "Invalid token" });
  }
};

app.post("/signup", async (req, res) => {
  const { name, email, phonenumber, password } = req.body;

  try {
    if (!name || !email || !phonenumber || !password) {
      return res
        .status(400)
        .json({ message: "please filled the all input fields" });
    }

    const existUser = await User.findOne({ email });

    if (existUser) {
      return res.status(400).json({ message: "User already exist" });
    }

    const hashPass = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      phonenumber,
      password: hashPass,
    });

    await newUser.save();
    res.status(200).json({ message: "Signup Done" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "please filled the all fields" });
    }

    const existUser = await User.findOne({ email });

    if (!existUser) {
      return res.status(400).json({ message: "user not found" });
    }

    const decPass = await bcrypt.compare(password, existUser.password);

    if (!decPass) {
      return res.status(400).json({ message: "wrong email and password" });
    }

    const token = jsonwebtoken.sign({ userId: existUser._id }, myJWT, {
      expiresIn: "2d",
    });

    res.status(200).json({
      message: "Login Done",
      token,
      user: {
        userId: existUser._id,
        userName: existUser.name,
        userEmail: existUser.email,
        userPhonenumber: existUser.phonenumber,
        userRole: existUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/forgetpassword", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "user not found" });
    }

    const tokenb = crypto.randomBytes(32).toString("hex");

    user.resetToken = tokenb;
    user.resetTokenExpire = Date.now() + 10 * 60 * 1000;

    await user.save();
    const resetLink = `https://hospitalappointnnent.netlify.app/resetpassword/${tokenb}`;

    await transporter.sendMail({
      from: "abhishekmevada85@gmail.com",
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 10 minutes.</p>
      `,
    });
    res.status(200).json({ message: "check mail" });
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.post("/resetpassword/:tokenb", async (req, res) => {
  const { password } = req.body;
  const tokenc = req.params.tokenb;

  const user = await User.findOne({
    resetToken: tokenc,
    resetTokenExpire: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  user.password = hashedPassword;
  user.resetToken = undefined;
  user.resetTokenExpire = undefined;

  await user.save();

  res.json({ message: "Password reset successful" });
});

app.post("/appointment", autiMiddleware, async (req, res) => {
  const { doctorId, date, time, reason } = req.body;
  const userId = req.user.userId;

  try {
    if (!doctorId || !date || !time || !reason) {
      return res
        .status(400)
        .json({ message: "please filled the all input fields" });
    }

    if (!userId) {
      return res
        .status(400)
        .json({ message: "please login to booked appoitment" });
    }

    const existappointment = await Appointment.findOne({
      doctorId,
      date,
      time,
    });
    if (existappointment) {
      return res.status(400).json({
        message:
          "In this time appointment already booked please choose another time",
      });
    }

    const patientAppointementExist = await Appointment.findOne({
      userId,
      time,
      date,
    });

    if (patientAppointementExist) {
      return res
        .status(400)
        .json({ message: "you already booked appointment at this time" });
    }

    const newappointment = new Appointment({
      userId,
      doctorId,
      date,
      time,
      reason,
    });

    await newappointment.save();
    res.status(200).json({ message: "appointment booked" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/appointmentget", autiMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const appointment = await Appointment.find({ userId }).populate("doctorId");

    res.status(200).json(appointment);
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.patch(
  "/appointementcancle/:appointmentId",
  autiMiddleware,
  async (req, res) => {
    const appointmentId = req.params.appointmentId;
    const userId = req.user.userId;

    try {
      const existAppointment = await Appointment.findById(appointmentId);

      if (!existAppointment) {
        return res.status(400).json({ message: "appointment not found" });
      }

      if (existAppointment.userId.toString() !== userId) {
        return res
          .status(400)
          .json({ message: "you can cancle your appointment" });
      }

      if (existAppointment.status !== "Booked") {
        return res
          .status(400)
          .json({ message: "you can cancle only booked appointment" });
      }

      existAppointment.status = "Cancelled";
      await existAppointment.save();

      res.status(200).json({ message: "Cancelled Appointment by User" });
    } catch (error) {
      res.status(500).json({ message: error });
    }
  },
);

app.patch("/reschedule/:id", autiMiddleware, async (req, res) => {
  const appoId = req.params.id;

  // const userId = req.user.userId;
  const { date, time } = req.body;

  try {
    if (!date || !time) {
      return res.status(400).json({ message: "please filled the detail" });
    }

    const appointment = await Appointment.findById(appoId);

    if (!appointment) {
      return res.status(400).json({ message: "appointment not found" });
    }
    appointment.date = date;
    appointment.time = time;
    await appointment.save();
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.post("/dsignup", async (req, res) => {
  const { dname, demail, dphonenumber, dspecialty, dpassword } = req.body;

  try {
    if (!dname || !demail || !dphonenumber || !dspecialty || !dpassword) {
      return res
        .status(400)
        .json({ message: "please filled the app input fields" });
    }

    const existDoctor = await Doctor.findOne({ demail });

    if (existDoctor) {
      return res.status(400).json({ message: "Doctor already exist" });
    }

    const decPass = await bcrypt.hash(dpassword, 10);

    const newUser = new Doctor({
      dname,
      demail,
      dphonenumber,
      dspecialty,
      dpassword: decPass,
    });

    await newUser.save();

    res.status(200).json({ message: "Doctor Signup" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/dlogin", async (req, res) => {
  const { demail, dpassword } = req.body;

  try {
    if (!demail || !dpassword) {
      return res
        .status(400)
        .json({ message: "please filled the all input fields" });
    }

    const existDoctor = await Doctor.findOne({ demail });

    if (!existDoctor) {
      return res.status(400).json({ message: "Doctor not Found" });
    }

    const hashPass = await bcrypt.compare(dpassword, existDoctor.dpassword);

    if (!hashPass) {
      return res.status(400).json({ message: "Invalid Email and Password" });
    }

    const token = jsonwebtoken.sign({ doctorId: existDoctor._id }, myJWT, {
      expiresIn: "4d",
    });

    res.status(200).json({
      message: "login done",
      token,
      doctor: {
        doctorId: existDoctor._id,
        doctorName: existDoctor.dname,
        doctorEmail: existDoctor.demail,
        doctorPhonenumber: existDoctor.dphonenumber,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.post("/dforgetpassword", async (req, res) => {
  const { email } = req.body;

  try {
    const doctor = await Doctor.findOne({ demail: email });

    if (!doctor) {
      return res.status(400).json({ message: "user not found" });
    }

    const tokenc = crypto.randomBytes(32).toString("hex");

    doctor.resetToken = tokenc;
    doctor.resetTokenExpire = Date.now() + 10 * 60 * 1000;

    await doctor.save();
    const resetLink = `https://hospitalappointnnent.netlify.app/dresetpassword/${tokenc}`;

    await transporter.sendMail({
      from: "abhishekmevada85@gmail.com",
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 10 minutes.</p>
      `,
    });
    res.status(200).json({ message: "check mail" });
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.post("/dresetpassword/:tokenc", async (req, res) => {
  const { password } = req.body;
  const tokenc = req.params.tokenc;

  const doctor = await Doctor.findOne({
    resetToken: tokenc,
    resetTokenExpire: { $gt: Date.now() },
  });

  if (!doctor) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  doctor.dpassword = hashedPassword;
  doctor.resetToken = undefined;
  doctor.resetTokenExpire = undefined;

  await doctor.save();

  res.json({ message: "Password reset successful" });
});

app.patch(
  "/appointmentsuccess/:appoinmentId",
  autiMiddleware,
  async (req, res) => {
    const appoinmentId = req.params.appoinmentId;

    const doctorId = req.user.doctorId;

    try {
      const existAppointment = await Appointment.findById(appoinmentId);

      if (!existAppointment) {
        return res.status(400).json({ message: "Appointment not Found" });
      }

      if (existAppointment.doctorId.toString() !== doctorId) {
        return res
          .status(400)
          .json({ message: "you can only complete your own appointments" });
      }

      if (existAppointment.status !== "Booked") {
        return res
          .status(400)
          .json({ message: "you can cancele only booked appointment" });
      }

      existAppointment.status = "Completed";
      await existAppointment.save();

      res.status(200).json({ message: "Appointment Completed" });
    } catch (error) {
      res.status(500).json({ message: error });
    }
  },
);

app.patch("/appointmentdoccancele/:id", autiMiddleware, async (req, res) => {
  const appointId = req.params.id;
  const doctorId = req.user.doctorId;

  try {
    const existAppoin = await Appointment.findById(appointId);

    if (!existAppoin) {
      return res.status(400).json({ message: "Appointment not found" });
    }

    if (existAppoin.doctorId.toString() !== doctorId) {
      return res
        .status(400)
        .json({ message: "You can only cancele your appintment" });
    }

    if (existAppoin.status !== "Booked") {
      return res
        .status(400)
        .json({ message: "You can only cancele your appointment" });
    }

    existAppoin.status = "Cancelled";
    await existAppoin.save();

    res.status(200).json({ message: "Appointment cancelled by doctor " });
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.get("/doctorlist", autiMiddleware, async (req, res) => {
  try {
    const doctorList = await Doctor.find();

    res.status(200).json(doctorList);
  } catch (error) {
    console.log(error);
  }
});

app.get("/doctorappointement", autiMiddleware, async (req, res) => {
  try {
    const doctorId = req.user.doctorId;

    const doctorAppointement = await Appointment.find({ doctorId })
      .populate("userId")
      .populate("doctorId");

    // console.log(doctorAppointement);

    res.status(200).json(doctorAppointement);
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.patch("/doctorappocomplete/:id", autiMiddleware, async (req, res) => {
  const appoId = req.params.id;
  const doctorId = req.user.doctorId;
  try {
    const comappo = await Appointment.findById(appoId);

    if (!comappo) {
      return res.status(400).json({ message: "Appointment Not Found" });
    }

    if (comappo.doctorId.toString() !== doctorId) {
      return res
        .status(400)
        .json({ message: "You can Complete only your appointment" });
    }

    comappo.status = "Completed";
    await comappo.save();
    res.status(200).json({ message: "Appointment Complete" });
  } catch (error) {
    res.status(500).json({ message: error });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// congenial-succotash
