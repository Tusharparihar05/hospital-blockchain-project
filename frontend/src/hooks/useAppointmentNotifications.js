// frontend/src/hooks/useAppointmentNotifications.js
// Sends TWO kinds of browser notifications:
//
//  1. TIME-BASED  — fires 1 hour before the appointment time.
//     Works for all confirmed appointments, even before check-in.
//
//  2. QUEUE-BASED — polls the backend every 60 s after the patient
//     checks in.  Fires when there is only 1 person ahead ("You're next!").
//
// HOW TO USE in PatientDashboard.jsx:
//   import { useAppointmentNotifications } from "../hooks/useAppointmentNotifications";
//   const { requestPermission, checkInToQueue } = useAppointmentNotifications(appointments);
//   // When patient arrives at clinic:
//   checkInToQueue(appointment);

import { useEffect, useRef, useCallback } from "react";

const API = import.meta.env?.VITE_API_URL
  || process.env.REACT_APP_API_URL
  || "http://localhost:5000";

// ── helpers ──────────────────────────────────────────────────────────────────

function parseApptDateTime(date, time) {
  // date: "2026-04-05", time: "11:00 AM"
  return new Date(`${date} ${time}`);
}

function sendNotification(title, body, tag) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon:              "/favicon.ico",
    tag,
    requireInteraction: true,
  });
  n.onclick = () => { window.focus(); n.close(); };
}

// ─────────────────────────────────────────────────────────────────────────────
export function useAppointmentNotifications(appointments = []) {
  const timeTimersRef  = useRef([]);   // setTimeout IDs for time-based
  const queueTimersRef = useRef({});   // setInterval IDs keyed by apptId
  const checkedInRef   = useRef({});   // apptId -> true when queue-polling started

  // ── Request browser permission ─────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      const p = await Notification.requestPermission();
      return p === "granted";
    }
    return false;
  }, []);

  // ── 1. Time-based: 1 hour before appointment ──────────────────────────────
  useEffect(() => {
    // Clear previous timers
    timeTimersRef.current.forEach(id => clearTimeout(id));
    timeTimersRef.current = [];

    const init = async () => {
      const allowed = await requestPermission();
      if (!allowed || !appointments.length) return;

      appointments.forEach(appt => {
        const { doctorName, date, time, _id, id } = appt;
        if (!date || !time) return;

        const apptTime  = parseApptDateTime(date, time);
        const notifyAt  = new Date(apptTime.getTime() - 60 * 60 * 1000); // 1 hr before
        const delay     = notifyAt.getTime() - Date.now();

        if (delay <= 0) return; // already past

        const timerId = setTimeout(() => {
          sendNotification(
            "⏰ Appointment Reminder – MediChain",
            `Your appointment with Dr. ${doctorName} is in 1 hour (${time}). Head to the clinic!`,
            `time-appt-${_id || id}`
          );
        }, delay);

        timeTimersRef.current.push(timerId);
      });
    };

    init();
    return () => timeTimersRef.current.forEach(id => clearTimeout(id));
  }, [appointments, requestPermission]);

  // ── 2. Queue-based: polls /api/queue/:apptId every 60 s after check-in ───
  const pollQueue = useCallback((appt) => {
    const apptId   = String(appt._id || appt.id);
    const doctorId = appt.doctorId;
    const date     = appt.date;

    if (queueTimersRef.current[apptId]) return; // already polling

    let lastAhead = null;

    const poll = async () => {
      try {
        const res  = await fetch(
          `${API}/api/queue/${apptId}?doctorId=${doctorId}&date=${date}`
        );
        if (!res.ok) return;
        const data = await res.json();

        if (!data.checkedIn) return;

        const ahead = data.ahead;

        // Notify when 1 person is ahead (was more before)
        if (ahead === 1 && lastAhead !== 1) {
          sendNotification(
            "🏥 Almost Your Turn! – MediChain",
            `There is 1 person ahead of you for Dr. ${appt.doctorName}. Get ready!`,
            `queue-1-${apptId}`
          );
        }

        // Notify when it's their turn
        if (ahead === 0 && lastAhead !== 0) {
          sendNotification(
            "🔔 It's Your Turn! – MediChain",
            `Dr. ${appt.doctorName} is ready to see you now. Please proceed!`,
            `queue-0-${apptId}`
          );
          // Stop polling — their appointment started
          clearInterval(queueTimersRef.current[apptId]);
          delete queueTimersRef.current[apptId];
        }

        lastAhead = ahead;
      } catch {
        // silent fail — network issues shouldn't crash the app
      }
    };

    poll(); // immediate first check
    queueTimersRef.current[apptId] = setInterval(poll, 60_000); // then every 60 s
  }, []);

  // ── checkInToQueue: called when patient physically arrives ─────────────────
  // Call this from your UI:
  //   const { checkInToQueue } = useAppointmentNotifications(appointments);
  //   <button onClick={() => checkInToQueue(selectedAppointment)}>I've Arrived</button>
  const checkInToQueue = useCallback(async (appt) => {
    const apptId   = String(appt._id || appt.id);
    const doctorId = appt.doctorId;
    const date     = appt.date;

    if (checkedInRef.current[apptId]) return; // already checked in

    try {
      const res = await fetch(`${API}/api/queue/checkin`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: apptId,
          doctorId,
          date,
          patientId: appt.patientId,
          time:      appt.time,
        }),
      });

      const data = await res.json();
      checkedInRef.current[apptId] = true;

      const ahead = data.position ?? data.ahead ?? 0;

      sendNotification(
        "✅ Checked In – MediChain",
        ahead === 0
          ? `You're next! Dr. ${appt.doctorName} will see you shortly.`
          : `You're #${ahead + 1} in queue. ${ahead} person${ahead > 1 ? "s" : ""} ahead of you.`,
        `checkin-${apptId}`
      );

      // Start polling for queue updates
      pollQueue(appt);

      return data;
    } catch (e) {
      console.error("[checkInToQueue]", e);
    }
  }, [pollQueue]);

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(queueTimersRef.current).forEach(id => clearInterval(id));
    };
  }, []);

  return { requestPermission, checkInToQueue };
}