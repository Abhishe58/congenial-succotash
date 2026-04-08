const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");

const dbConnect = async () => {
  try {
    mongoose
      .connect(process.env.MONGODB)
      .then(() => console.log("MongoDB Connected"))
      .catch((err) => console.log("Error", err));
    console.log("db connected");
  } catch (error) {
    console.log(error);
  }
};

dbConnect();

const userSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phonenumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "Patient" },
  resetToken: String,
  resetTokenExpire: Date,
});

const User = mongoose.model("user", userSchema);

const doctorSchema = mongoose.Schema({
  dname: { type: String, required: true },

  demail: { type: String, required: true, unique: true },
  dphonenumber: { type: String, required: true },
  dspecialty: { type: String, required: true },
  dpassword: { type: String, required: true },
  resetToken: String,
  resetTokenExpire: Date,
});

const Doctor = mongoose.model("doctor", doctorSchema);

const appoitmentSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "user" },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "doctor",
  },
  date: { type: String, required: true },
  time: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, required: true, default: "Booked" },
});

appoitmentSchema.index({ doctorId: 1, date: 1, time: 1 }, { unique: true });

const Appointment = mongoose.model("appointment", appoitmentSchema);

module.exports = { User, Doctor, Appointment };
