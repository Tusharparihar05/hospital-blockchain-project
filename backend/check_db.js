const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({}, { strict: false });
const Appointment = mongoose.model("Appointment", appointmentSchema);

async function run() {
  await mongoose.connect('mongodb+srv://priyanshu62:priyanshu321@cluster0.niyac7o.mongodb.net/medichain?appName=Cluster0');
  const a = await Appointment.findOne({ paymentScreenshot: { $ne: "" } }).sort({createdAt: -1}).lean();
  console.log('Found appointment?', !!a);
  if (a) {
    console.log('Length:', a.paymentScreenshot ? a.paymentScreenshot.length : 0);
    console.log('Prefix:', a.paymentScreenshot ? a.paymentScreenshot.substring(0, 100) : '');
  }
  process.exit(0);
}
run();
