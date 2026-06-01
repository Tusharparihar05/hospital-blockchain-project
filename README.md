<![CDATA[# 🏥 MediChain — Blockchain-Powered Healthcare Platform

<div align="center">

![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%209-47A248?logo=mongodb&logoColor=white)
![Ethereum](https://img.shields.io/badge/Ethereum-Hardhat-3C3C3D?logo=ethereum&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

**A full-stack decentralized healthcare platform that combines Web2 infrastructure with Ethereum blockchain for tamper-proof medical records, appointment NFTs, on-chain doctor verification, AI-powered report analysis, and an emergency SOS system.**

### 🌐 [Live Demo → hospital-blockchain-project.vercel.app](https://hospital-blockchain-project.vercel.app)

[Features](#-features) · [Architecture](#-architecture) · [Smart Contracts](#-smart-contracts) · [Getting Started](#-getting-started) · [API Reference](#-api-reference) · [Environment Variables](#-environment-variables)

</div>

---

## ✨ Features

### 🔗 Blockchain & Web3
- **On-chain medical record anchoring** — File hashes (keccak256 / SHA-256) are anchored on Ethereum via the `PatientRecords` contract for tamper-proof integrity verification
- **ERC-721 Appointment NFTs** — Each confirmed appointment mints an NFT (`AppointmentToken`) as immutable proof of visit
- **Doctor Registry** — Multi-step on-chain verification workflow (Register → Verify → Revoke) with permanent audit trail
- **Patient Registry** — On-chain patient registration with per-doctor access grants and revocation
- **MetaMask Integration** — Wallet-based signup/login, transaction signing for record anchoring and appointment minting
- **IPFS Storage** — Medical files pinned to IPFS via Pinata; blockchain stores only file hashes

### 🤖 AI-Powered Features
- **Medical Report Analysis** — Groq LLaMA 3.3 70B analyzes uploaded reports, returning structured findings (summary, key findings, abnormal values, recommendations, precautions)
- **20+ Language Support** — AI analysis available in English, Hindi, Bengali, Tamil, Telugu, Marathi, Spanish, German, French, Arabic, Japanese, and more
- **Text-to-Speech** — Gemini 2.5 Flash TTS converts medical report summaries to audio narration in the selected language
- **Simple/Detailed Modes** — Toggle between simplified explanations and detailed medical analysis

### 🏨 Core Healthcare Features
- **Appointment Booking** — Multi-step booking flow (Department → Doctor → Date/Time → Confirm) with on-chain NFT minting
- **Live Patient Queue** — Real-time queue position tracking with token assignment, auto-polling (every 60s), and "You're next!" / "It's your turn!" alerts
- **Medical Records Management** — Upload, view, and download medical records (PDF, JPG, PNG, DICOM) with timeline view grouped by month
- **Doctor Report Clearance** — Doctors review and sign off on patient reports, with clearance anchored on blockchain
- **Emergency SOS** — GPS-based emergency alerts that share patient medical history with nearby hospitals, including ambulance ETA
- **Nearby Doctors Map** — Interactive Leaflet map with GPS or text-based location, Haversine distance filtering, and doctor profile cards
- **Doctor License Verification** — NMC/ABDM Healthcare Professionals Registry (HPR) sandbox-based license verification on the landing page

### 💳 Payment System
- **Razorpay Integration** — Full payment gateway with order creation, Razorpay Checkout, and server-side verification
- **UPI QR Payments** — Dynamic QR code generation for doctor's UPI ID with screenshot upload as payment proof
- **Simulated Gateway** — HMAC-SHA256 signed test payment gateway for development

### 👥 Role-Based Access
| Role | Capabilities |
|------|-------------|
| **Patient** | View own records, book appointments, upload reports, blockchain verification, AI report analysis, SOS emergency, nearby doctors, queue check-in |
| **Doctor** | Manage patient queue, submit/upload reports for patients, clear/sign-off records, set clinic location & availability, manage profile |

### 🔔 Real-Time Notifications
- **Browser Push Notifications** — Notifications API for queue updates, treatment completion, and appointment reminders
- **Audio Buzzer Alerts** — Web Audio API sound alerts for urgent events
- **Cross-Tab Sync** — BroadcastChannel API keeps multiple browser tabs in sync (e.g., doctor uploads report → patient tab updates)
- **5-Second Polling** — Real-time notification polling on the patient dashboard

### 🔐 Authentication
- **JWT-based auth** — 7-day token expiry, stored in localStorage
- **Email + Password login** — Traditional authentication with bcrypt (12 salt rounds)
- **MetaMask wallet login** — Auto-creates patient account if wallet address not found
- **Role-filtered login** — Optional role parameter during login
- **Offline fallback** — Signup/login gracefully degrade when backend is unreachable (saves to localStorage)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MediChain Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Frontend (React 18)          Backend (Express 5 + MongoDB)    │
│   ├── React Router v6          ├── JWT Authentication           │
│   ├── Ethers.js v6             ├── Ethers.js v6                 │
│   ├── Leaflet Maps             ├── Pinata (IPFS)                │
│   ├── Razorpay SDK             ├── Groq AI (LLaMA 3.3 70B)     │
│   ├── Web Crypto API           ├── Gemini 2.5 Flash TTS         │
│   ├── Sonner (toasts)          ├── Razorpay Gateway             │
│   └── BroadcastChannel         └── Multer (file uploads)        │
│                                                                 │
│   Blockchain (Hardhat + Solidity 0.8.20)                        │
│   ├── PatientRecords.sol    — keccak256 file hash anchoring     │
│   ├── AppointmentToken.sol  — ERC-721 appointment NFTs          │
│   ├── DoctorRegistry.sol    — Doctor verification workflow      │
│   └── PatientRegistry.sol   — Patient registration & access     │
│                                                                 │
│   Design: Hybrid Web2 / Web3                                    │
│   MongoDB stores full data; blockchain stores hashes,           │
│   registrations, and NFTs for integrity & auditability.         │
│   Files are stored on IPFS via Pinata.                          │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
hospital-blockchain-project/
├── backend/
│   ├── server.js                # Express server — all routes, schemas & logic
│   ├── middleware/
│   │   └── auth.js              # JWT auth + role authorization middleware
│   ├── services/
│   │   └── emailService.js      # Nodemailer email templates
│   ├── scripts/
│   │   └── check_db.js          # Database connection tester
│   └── .env.example             # Environment variable template
├── blockchain/
│   ├── contracts/
│   │   ├── PatientRecords.sol   # File hash anchoring on-chain
│   │   ├── AppointmentToken.sol # ERC-721 appointment NFTs
│   │   ├── DoctorRegistry.sol   # Doctor verification registry
│   │   └── PatientRegistry.sol  # Patient registration & access control
│   ├── scripts/
│   │   └── deploy.js            # Deploys all 4 contracts
│   ├── test/
│   │   └── MediChain.test.js    # Smart contract test suite
│   ├── hardhat.config.js        # Hardhat config (localhost network)
│   └── deployed-addresses.json  # Deployed contract addresses
├── frontend/
│   ├── src/
│   │   ├── App.js               # Routes, layout, shared components
│   │   ├── pages/
│   │   │   ├── landingpage.js       # Public landing page + license verification
│   │   │   ├── Signup.js            # Patient/Doctor registration + MetaMask
│   │   │   ├── Login.js             # Login (email/password or wallet)
│   │   │   ├── patientdashbord.js   # Full patient portal (113KB)
│   │   │   ├── DoctorDashboard.js   # Full doctor portal (126KB)
│   │   │   ├── patientsubmit.js     # Patient report upload + blockchain anchor
│   │   │   ├── doctororstafsubmitpage.js  # Doctor report submission
│   │   │   ├── MedicalReportAnalyzer.js   # AI report analysis + TTS
│   │   │   ├── NearbyDoctorsMap.jsx       # Leaflet map for nearby doctors
│   │   │   ├── NotificationBell.jsx       # Notification component
│   │   │   ├── AvailabilityCalendar.js    # Doctor availability widget
│   │   │   ├── ClinicLocationSetter.jsx   # Clinic GPS location setter
│   │   │   └── notfound.js               # 404 page
│   │   ├── hooks/
│   │   │   ├── useBlockchain.js           # MetaMask + contract interactions
│   │   │   ├── useAppointmentNotifications.js  # Queue polling + alerts
│   │   │   └── useNearbyDoctors.js        # GPS + Haversine distance
│   │   └── abis/
│   │       ├── PatientRecords.json        # PatientRecords contract ABI
│   │       └── AppointmentToken.json      # AppointmentToken contract ABI
│   └── public/
├── vercel.json                  # Vercel deployment configuration
└── LICENSE                      # MIT License
```

---

## 📄 Frontend Pages & Routes

| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/` | `LandingPage` | Public | Hero page with features, stats, testimonials, doctor license verification |
| `/signup` | `Signup` | Public | Patient/Doctor registration with MetaMask wallet linking |
| `/login` | `Login` | Public | Email+password or MetaMask wallet login |
| `/dashboard` | `DashboardLayout` | Protected | Tab-based dashboard: Stats, Book Appointment, My Records, Doctors, Emergency |
| `/doctor` | `DoctorDashboard` | Doctor/Admin | Doctor portal: patient queue, profile, appointments, record viewer |
| `/doctor/submit` | `DoctorSubmitPage` | Doctor/Admin | Upload reports for patients with blockchain anchoring |
| `/patient/dashboard` | `PatientDashboard` | Patient/Admin | Patient portal: records, notifications, nearby doctors, appointments, payments |
| `/patient/upload` | `PatientSubmit` | Patient/Admin | Upload own medical reports with IPFS + blockchain |
| `/patient/analyze` | `MedicalReportAnalyzer` | Patient/Admin | AI-powered report analysis in 20+ languages with TTS |

---

## 📜 Smart Contracts

### PatientRecords.sol
Anchors keccak256 file hashes on-chain for tamper-proof medical record integrity. Files are stored on IPFS; only their hashes live on-chain.

| Function | Description |
|----------|-------------|
| `anchorRecord(patientId, fileHash, category, fileName)` | Anchor a file hash for a patient |
| `verifyRecord(patientId, fileHash)` | Verify if a record hash exists and is valid |
| `getRecord(patientId, index)` | Retrieve record metadata by index |
| `isAnchored(fileHash)` | Check if a hash has been anchored globally |
| `recordCount(patientId)` | Total records for a patient |

### AppointmentToken.sol (ERC-721)
Custom NFT contract — mints a unique token for every confirmed appointment. Token: **MediChain Appointment (MCAPPT)**.

| Function | Description |
|----------|-------------|
| `mintAppointmentToken(...)` | Mint NFT for a confirmed appointment |
| `getTokenByAppointmentId(appointmentId)` | Lookup token by appointment ID |
| `getPatientTokens(patientId)` | Get all token IDs for a patient |
| `getAppointmentData(tokenId)` | Full appointment metadata for a token |
| Standard ERC-721 | `ownerOf`, `balanceOf`, `transferFrom`, `approve`, etc. |

### DoctorRegistry.sol
On-chain registry with a multi-step verification workflow: **Register → Verify → (optionally) Revoke**. Revocation is permanent with on-chain reason.

| Function | Access | Description |
|----------|--------|-------------|
| `registerDoctor(...)` | Owner | Register doctor on-chain |
| `verifyDoctor(wallet)` | Owner | Set status to Verified |
| `revokeDoctor(wallet, reason)` | Owner | Permanently revoke with reason |
| `isVerified(wallet)` | Public | Check verification status |
| `getDoctorStatus(wallet)` | Public | Raw status code (0=None, 1=Registered, 2=Verified, 3=Revoked) |

### PatientRegistry.sol
On-chain patient registration with per-doctor access grants. Patients control which doctors can view their records.

| Function | Access | Description |
|----------|--------|-------------|
| `registerPatient(...)` | Owner | Register patient on-chain |
| `grantAccess(patientId, doctorWallet)` | Patient/Owner | Grant doctor access to records |
| `revokeAccess(patientId, doctorWallet)` | Patient/Owner | Revoke doctor access |
| `hasAccess(patientId, doctorWallet)` | Public | Check if doctor has access |
| `isRegistered(patientId)` | Public | Check registration status |

---

## 🗄️ Database Models

All schemas are defined inline in `server.js`:

| Model | Key Fields | Purpose |
|-------|------------|---------|
| **User** | name, email, passwordHash, role (patient/doctor/admin), patientId (`HLT-0xXXXXXX`), walletAddress, specialty, licenseNumber, fee, rating, availability, location{lat,lng}, upiId | Users with role-specific fields |
| **MedicalRecord** | patientId, fileName, category, fileHash, blockchainTx, ipfsCid, ipfsUrl, anchoredOnChain, aiSummary, doctorComment, cleared, clearanceTx | Medical records with blockchain + IPFS |
| **Appointment** | patientId, doctorId, dept, date, time, status, fee, paymentMethod, tokenId, queuePosition, checkedIn, treatmentDuration | Appointments with queue tracking |
| **LicenceVerification** | email, licenseNumber, documentHash, status, councilName, specialization, verificationMethod | Doctor license verification records |
| **Notification** | patientId, type (queue_update/treatment_complete/appointment_reminder/doctor_report/no_show), title, message, read | Push notifications |
| **EmergencyAlert** | patientId, patientName, phone, bloodGroup, location{lat,lng}, status, acknowledgedBy, nearbyHospitals[] | SOS emergency alerts |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **MongoDB** (local instance or MongoDB Atlas)
- **MetaMask** browser extension
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/Tusharparihar05/hospital-blockchain-project.git
cd hospital-blockchain-project
```

### 2. Set Up the Blockchain

```bash
cd blockchain
npm install

# Start a local Hardhat node (keep this terminal open)
npx hardhat node

# In a new terminal — deploy all 4 contracts
npx hardhat run scripts/deploy.js --network localhost
```

The deploy script will print contract addresses and environment variables for both `backend/.env` and `frontend/.env`. Copy these values.

### 3. Set Up the Backend

```bash
cd backend
npm install

# Create .env from example and fill in values
cp .env.example .env
# Edit .env — see Environment Variables section below

# Start the server
node server.js
```

The backend runs on `http://localhost:5000` by default.

### 4. Set Up the Frontend

```bash
cd frontend
npm install

# Create .env file with:
# REACT_APP_API_URL=http://localhost:5000/api
# REACT_APP_PATIENT_RECORDS_ADDRESS=<from deploy output>
# REACT_APP_APPOINTMENT_TOKEN_ADDRESS=<from deploy output>

# Start the development server
npm start
```

The frontend runs on `http://localhost:3000` by default.

### 5. Connect MetaMask

1. Open MetaMask and add a custom network:
   - **Network Name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** ETH
2. Import a Hardhat test account using one of the private keys printed when you ran `npx hardhat node`

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/signup` | No | Register new user (patient/doctor/admin) |
| `POST` | `/api/auth/login` | No | Login with email + password (optional role filter) |
| `POST` | `/api/auth/wallet-login` | No | Login with MetaMask wallet (auto-creates account) |
| `GET` | `/api/auth/me` | Yes | Get current user profile |

### Medical Records
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/records` | No | Upload record (file via multer, auto-anchors on blockchain + IPFS) |
| `GET` | `/api/records/:patientId` | Yes | Get patient's records (cached 15s) |
| `GET` | `/api/records/file/:recordId` | No | Download/stream stored file |
| `GET` | `/api/records/:patientId/timeline` | Yes | Records grouped by month (cached 15s) |
| `POST` | `/api/records/:recordId/clear` | Yes | Doctor signs off on a report (anchors clearance on-chain) |
| `GET` | `/api/reports` | Yes | Get current user's medical records |
| `GET` | `/api/records` | Yes | Get all records (admin/doctor) |

### Appointments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/appointments` | Yes | Book new appointment (with duplicate prevention) |
| `GET` | `/api/appointments/patient` | Yes | Get current user's appointments |
| `GET` | `/api/appointments` | Yes | Get all or filtered appointments |
| `PUT` | `/api/appointments/:id/verify-payment` | Yes | Verify UPI payment & confirm appointment |
| `PUT` | `/api/appointments/:id/complete` | Yes | Mark appointment completed (mints NFT) |
| `PUT` | `/api/appointments/:id/reschedule` | Yes | Request reschedule |

### Queue Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/queue/checkin` | Yes | Patient checks in, gets queue token |
| `GET` | `/api/queue/:appointmentId` | No | Check queue position |
| `POST` | `/api/queue/next` | Yes | Doctor advances the queue |
| `GET` | `/api/queue` | No | Get full queue for doctor + date |
| `POST` | `/api/queue/complete/:appointmentId` | Yes | Mark specific appointment complete |

### Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/payment/create-order` | Yes | Create payment order (HMAC-signed) |
| `POST` | `/api/payment/verify` | Yes | Verify payment & create appointment |

### Doctors
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/doctors` | No | List all active doctors (public) |
| `GET` | `/api/doctors/:id` | No | Get doctor profile |
| `PATCH` | `/api/doctors/:id` | Yes | Update own doctor profile |
| `PUT` | `/api/doctors/:id/location` | Yes | Set clinic GPS coordinates |
| `PUT` | `/api/doctors/:id/online-status` | Yes | Toggle online/offline status |

### Patients
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/patients` | Yes | List all active patients |
| `GET` | `/api/patients/:id` | Yes | Get patient by ID |

### Emergency
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/emergency` | No | Activate SOS emergency alert (GPS-based) |
| `GET` | `/api/emergency/active` | No | Get all active emergencies |
| `POST` | `/api/emergency/:id/acknowledge` | Yes | Doctor acknowledges emergency |
| `POST` | `/api/emergency/:id/resolve` | No | Resolve emergency alert |

### Doctor License Verification
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/verification/doctor-license` | No | Submit license for NMC/ABDM verification |
| `GET` | `/api/verification/doctor-license` | No | Check verification status by email |
| `GET` | `/api/verification/lookup` | No | Public lookup by license number, email, or name |
| `GET` | `/api/verification/status/:doctorId` | No | Quick verification status for a doctor |

### AI & Analysis
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/analyze-report` | No | AI medical report analysis (Groq LLaMA 3.3 70B) |
| `POST` | `/api/tts` | No | Text-to-speech (Gemini 2.5 Flash TTS) |

### Notifications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/notifications/:patientId` | No | Get patient notifications (last 50) |
| `PUT` | `/api/notifications/:id/read` | No | Mark notification as read |
| `PUT` | `/api/notifications/read-all/:patientId` | No | Mark all notifications as read |

### Wallet
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/wallet/connect` | No | Connect wallet, lookup linked patient |

### Dashboard
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/dashboard` | No | Platform stats (total patients, today's appointments, on-chain records) |

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 5000) | No |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `GROQ_API_KEY` | Groq API key for AI report analysis | Yes |
| `GEMINI_API_KEY` | Google Gemini API key for TTS | Yes |
| `PINATA_JWT` | Pinata JWT for IPFS file uploads | Yes |
| `DEPLOYER_PRIVATE_KEY` | Ethereum private key for contract calls | Yes |
| `BLOCKCHAIN_RPC_URL` | Ethereum RPC URL (e.g., `http://127.0.0.1:8545`) | Yes |
| `PATIENT_RECORDS_ADDRESS` | Deployed PatientRecords contract address | Yes |
| `APPOINTMENT_TOKEN_ADDRESS` | Deployed AppointmentToken contract address | Yes |
| `DOCTOR_REGISTRY_ADDRESS` | Deployed DoctorRegistry contract address | Yes |
| `PATIENT_REGISTRY_ADDRESS` | Deployed PatientRegistry contract address | Yes |
| `SIMULATED_GATEWAY_SECRET` | HMAC secret for simulated payment gateway | No |
| `RAZORPAY_KEY_ID` | Razorpay API key ID (for production payments) | No |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret | No |

### Frontend (`frontend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_API_URL` | Backend API URL (e.g., `http://localhost:5000/api`) | Yes |
| `REACT_APP_BLOCKCHAIN_ENABLED` | Enable/disable blockchain features | No |
| `REACT_APP_PATIENT_RECORDS_ADDRESS` | PatientRecords contract address | Yes |
| `REACT_APP_APPOINTMENT_TOKEN_ADDRESS` | AppointmentToken contract address | Yes |

### Blockchain (`blockchain/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Deployer wallet private key | Yes |

---

## 🧪 Testing

### Smart Contract Tests

```bash
cd blockchain
npx hardhat test
```

The test suite covers:
- ✅ Contract deployment & ownership
- ✅ Patient registration & duplicate prevention
- ✅ Doctor registration (owner-only access)
- ✅ Medical record creation & retrieval
- ✅ Appointment booking, completion & cancellation
- ✅ Access control (grant/revoke permissions)

---

## 🚢 Deployment

### Vercel (Configured)

The project includes a `vercel.json` for deployment:
- **Backend** → Serverless function via `@vercel/node`
- **Frontend** → Static build via `@vercel/static-build`
- API routes (`/api/*`) are proxied to the backend

```bash
vercel --prod
```

### Blockchain

Currently configured for **localhost** (Hardhat node, chainId 31337). To deploy to Sepolia testnet, add the network configuration to `hardhat.config.js`:

```js
sepolia: {
  url: process.env.SEPOLIA_RPC_URL,
  accounts: [process.env.PRIVATE_KEY],
}
```

Then run:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router v6, Ethers.js v6, Leaflet + React Leaflet, Razorpay SDK, Sonner, Lucide React, Web Crypto API |
| **Backend** | Node.js, Express 5, Mongoose 9, JWT, bcryptjs, Multer, Ethers.js v6 |
| **Blockchain** | Solidity 0.8.20, Hardhat, OpenZeppelin, 4 smart contracts |
| **Database** | MongoDB |
| **File Storage** | IPFS (Pinata) |
| **AI/ML** | Groq (LLaMA 3.3 70B) for report analysis, Google Gemini 2.5 Flash for TTS |
| **Payments** | Razorpay, UPI QR codes |
| **Maps** | Leaflet, OpenStreetMap Nominatim geocoding |
| **Deployment** | Vercel |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Authors

- **[Tushar Parihar](https://github.com/Tusharparihar05)**
- **Priyanshu Kumar**
]]>
