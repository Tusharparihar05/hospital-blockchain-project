const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:   { type: String, required: true },
  role:           { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  phone:          { type: String, default: '' },
  patientId:      { type: String },
  chainPatientId: { type: Number },
  dateOfBirth:    { type: Date },
  gender:         { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  bloodGroup:     { type: String, default: '' },
  specialty:       { type: String, default: '' },
  licenseNumber:   { type: String, default: '' },
  licenseVerified: { type: Boolean, default: false },
  hospital:        { type: String, default: '' },
  experience:      { type: Number, default: 0 },
  fee:             { type: Number, default: 500 },
  rating:          { type: Number, default: 0 },
  reviewCount:     { type: Number, default: 0 },
  bio:             { type: String, default: '' },
  education:       { type: String, default: '' },
  languages:       [{ type: String }],
  tags:            [{ type: String }],
  availability:    [{ type: String }],
  status:          { type: String, enum: ['online', 'busy', 'offline'], default: 'online' },
  walletAddress:   { type: String, default: '' },
  isActive:        { type: Boolean, default: true },
  lastLogin:       { type: Date },
}, { timestamps: true });

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ specialty: 1, isActive: 1 });
userSchema.index({ name: 'text', specialty: 'text', hospital: 'text' });

// FIX: sparse only — do NOT add unique: true here.
// Doctors and admins never get a patientId, so their patientId field is
// undefined. MongoDB treats multiple undefined values as duplicates when
// unique: true is set, causing "E11000 duplicate key" on the second doctor
// you register. sparse: true already excludes null/undefined documents from
// the index, which is all we need.
userSchema.index({ patientId: 1 }, { sparse: true });

userSchema.pre('save', async function () {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  if (this.role === 'patient' && !this.patientId) {
    const hex = Math.floor(Math.random() * 0xFFFFFF)
      .toString(16).toUpperCase().padStart(6, '0');
    this.patientId      = 'HLT-0x' + hex;
    this.chainPatientId = parseInt(hex, 16) % 900000 + 100000;
  }
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);