// scripts/seed.js — run: node scripts/seed.js
require("dotenv").config();
const mongoose = require("mongoose");
const User     = require("../models/User");

const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medichain";

const doctors = [
  {
    name: "Dr. Ananya Singh", email: "ananya.singh@aiims.edu",
    passwordHash: "Doctor@123",
    role: "doctor", specialty: "Cardiology", hospital: "AIIMS New Delhi",
    experience: 12, fee: 800, rating: 4.8, reviewCount: 312,
    licenseNumber: "MCI123456", licenseVerified: true,
    bio: "Pioneer in minimally invasive cardiac procedures with 12 years at AIIMS.",
    education: "MBBS – AIIMS | MD Cardiology – PGI Chandigarh",
    languages: ["English", "Hindi", "Punjabi"],
    tags: ["Heart Disease", "Hypertension", "Arrhythmia", "Heart Failure"],
    availability: ["9:00 AM", "10:30 AM", "2:00 PM", "4:00 PM"],
    status: "online",
  },
  {
    name: "Dr. Vikram Patel", email: "vikram.patel@fortis.com",
    passwordHash: "Doctor@123",
    role: "doctor", specialty: "Dermatology", hospital: "Fortis Bangalore",
    experience: 8, fee: 600, rating: 4.5, reviewCount: 198,
    licenseNumber: "KMC654321", licenseVerified: true,
    bio: "Expert in acne management, eczema, psoriasis, and cosmetic dermatology.",
    education: "MBBS – KMC Manipal | MD Dermatology – JIPMER",
    languages: ["English", "Hindi", "Gujarati"],
    tags: ["Acne", "Eczema", "Psoriasis", "Skin Cancer Screening"],
    availability: ["11:00 AM", "1:00 PM", "3:30 PM", "5:00 PM"],
    status: "online",
  },
  {
    name: "Dr. Meena Roy", email: "meena.roy@apollo.com",
    passwordHash: "Doctor@123",
    role: "doctor", specialty: "Orthopedics", hospital: "Apollo Chennai",
    experience: 15, fee: 1000, rating: 4.9, reviewCount: 427,
    licenseNumber: "TNM789012", licenseVerified: true,
    bio: "15 years excellence in joint replacement surgery.",
    education: "MBBS – Stanley Medical | MS Ortho – CMC Vellore",
    languages: ["English", "Tamil", "Malayalam"],
    tags: ["Joint Replacement", "Spine", "Sports Injury", "Arthroscopy"],
    availability: ["9:30 AM", "11:30 AM", "2:30 PM"],
    status: "busy",
  },
  {
    name: "Dr. Suresh Nair", email: "suresh.nair@kokilaben.com",
    passwordHash: "Doctor@123",
    role: "doctor", specialty: "Neurology", hospital: "Kokilaben Mumbai",
    experience: 10, fee: 900, rating: 4.7, reviewCount: 261,
    licenseNumber: "MMC345678", licenseVerified: true,
    bio: "Specializes in epilepsy and stroke management.",
    education: "MBBS – Grant Medical | DM Neurology – NIMHANS",
    languages: ["English", "Hindi", "Malayalam", "Marathi"],
    tags: ["Migraine", "Epilepsy", "Stroke", "Parkinson's"],
    availability: ["10:00 AM", "12:00 PM", "3:00 PM", "5:30 PM"],
    status: "offline",
  },
  {
    name: "Dr. Priya Sharma", email: "priya.sharma@medanta.com",
    passwordHash: "Doctor@123",
    role: "doctor", specialty: "Pediatrics", hospital: "Medanta Gurgaon",
    experience: 7, fee: 500, rating: 4.6, reviewCount: 183,
    licenseNumber: "HRY901234", licenseVerified: true,
    bio: "Pediatrician with expertise in neonatal care.",
    education: "MBBS – Lady Hardinge | MD Pediatrics – AIIMS",
    languages: ["English", "Hindi"],
    tags: ["Fever", "Growth Disorders", "Asthma", "Malnutrition"],
    availability: ["9:00 AM", "11:00 AM", "2:00 PM", "4:30 PM"],
    status: "online",
  },
];

const patients = [
  {
    name: "Arjun Sharma", email: "arjun.sharma@email.com",
    passwordHash: "Patient@123",
    role: "patient", phone: "+91 9876543210", gender: "Male",
  },
  {
    name: "Priya Mehta", email: "priya.mehta@email.com",
    passwordHash: "Patient@123",
    role: "patient", phone: "+91 9812345678", gender: "Female",
  },
  {
    name: "Ravi Kumar", email: "ravi.kumar@email.com",
    passwordHash: "Patient@123",
    role: "patient", phone: "+91 9834567890", gender: "Male",
  },
];

async function seed() {
  await mongoose.connect(MONGO);
  console.log("Connected to MongoDB:", MONGO);

  // Clear existing
  await User.deleteMany({ role: { $in: ["doctor", "patient"] } });
  console.log("Cleared existing users");

  // Insert doctors
  for (const d of doctors) {
    await User.create(d);
    console.log("  ✅ Doctor:", d.name);
  }

  // Insert patients
  for (const p of patients) {
    await User.create(p);
    console.log("  ✅ Patient:", p.name);
  }

  console.log("\nSeed complete!");
  console.log("Doctor login:  any doctor email above / Doctor@123");
  console.log("Patient login: any patient email above / Patient@123");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });// Paste your seed data script here