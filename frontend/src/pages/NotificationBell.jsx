// frontend/src/components/NotificationBell.jsx
import React, { useState, useEffect, useRef } from "react";

/**
 * NotificationBell Component
 *
 * Shows a bell icon in the navbar with upcoming appointment alerts.
 * Also handles requesting browser notification permission.
 *
 * Props:
 *   - appointments: Array [{ _id, doctorName, date, time, specialty }]
 */
const NotificationBell = ({ appointments = [] }) => {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [permissionGranted, setPermissionGranted] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Build list of upcoming appointment alerts (within next 24 hours)
    const now = new Date();
    const upcoming = appointments
      .map((appt) => {
        const apptTime = parseTime(appt.date, appt.time);
        const diffMs = apptTime - now;
        const diffHrs = diffMs / (1000 * 60 * 60);
        return { ...appt, diffHrs, apptTime };
      })
      .filter((a) => a.diffHrs > 0 && a.diffHrs <= 24)
      .sort((a, b) => a.diffHrs - b.diffHrs);

    setAlerts(upcoming);
  }, [appointments]);

  const parseTime = (date, time) => {
    return new Date(`${date} ${time}`);
  };

  const formatTimeLeft = (diffHrs) => {
    if (diffHrs < 1) {
      const mins = Math.round(diffHrs * 60);
      return `in ${mins} min`;
    }
    return `in ${diffHrs.toFixed(1)} hrs`;
  };

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setPermissionGranted(perm === "granted");
    if (perm === "granted") {
      new Notification("✅ MediChain Notifications Enabled", {
        body: "You'll get reminders 1 hour before your appointments.",
        icon: "/favicon.ico",
      });
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasAlerts = alerts.length > 0;

  return (
    <div style={styles.wrapper} ref={dropdownRef}>
      <button style={styles.bell} onClick={() => setOpen((o) => !o)} title="Notifications">
        🔔
        {hasAlerts && <span style={styles.badge}>{alerts.length}</span>}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropHeader}>
            <span style={styles.dropTitle}>Appointment Reminders</span>
          </div>

          {!permissionGranted && (
            <div style={styles.permBanner}>
              <span>Enable browser notifications for reminders</span>
              <button style={styles.enableBtn} onClick={requestPermission}>
                Enable
              </button>
            </div>
          )}

          {alerts.length === 0 ? (
            <div style={styles.empty}>No upcoming appointments in the next 24 hours.</div>
          ) : (
            alerts.map((appt, i) => (
              <div key={appt._id || i} style={styles.alertItem}>
                <div style={styles.alertIcon}>⏰</div>
                <div style={styles.alertInfo}>
                  <div style={styles.alertDoc}>
                    {appt.doctorName || appt.doctor?.name || "Dr. Unknown"}
                  </div>
                  <div style={styles.alertMeta}>
                    {appt.specialty || ""} · {appt.time}
                  </div>
                  <div style={styles.alertTime}>
                    {appt.diffHrs <= 1.05 ? (
                      <span style={{ color: "#f87171" }}>
                        ⚡ {formatTimeLeft(appt.diffHrs)} — Get ready!
                      </span>
                    ) : (
                      <span style={{ color: "#60a5fa" }}>
                        🕐 {formatTimeLeft(appt.diffHrs)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  wrapper: {
    position: "relative",
    display: "inline-block",
  },
  bell: {
    background: "transparent",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    position: "relative",
    padding: "4px 8px",
  },
  badge: {
    position: "absolute",
    top: "0",
    right: "0",
    background: "#ef4444",
    color: "#fff",
    borderRadius: "50%",
    fontSize: "10px",
    width: "16px",
    height: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    lineHeight: 1,
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: "36px",
    width: "300px",
    background: "#1a1f2e",
    border: "1px solid #2a3040",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    zIndex: 9999,
    overflow: "hidden",
  },
  dropHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #2a3040",
  },
  dropTitle: {
    color: "#e0e6f0",
    fontWeight: 600,
    fontSize: "14px",
  },
  permBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#1e2d45",
    padding: "10px 16px",
    gap: "8px",
    fontSize: "12px",
    color: "#93c5fd",
  },
  enableBtn: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "11px",
    flexShrink: 0,
  },
  empty: {
    padding: "20px 16px",
    color: "#6b7280",
    fontSize: "13px",
    textAlign: "center",
  },
  alertItem: {
    display: "flex",
    gap: "12px",
    padding: "12px 16px",
    borderBottom: "1px solid #1e2535",
  },
  alertIcon: {
    fontSize: "20px",
    flexShrink: 0,
  },
  alertInfo: {
    flex: 1,
  },
  alertDoc: {
    color: "#e0e6f0",
    fontWeight: 600,
    fontSize: "13px",
  },
  alertMeta: {
    color: "#9ca3af",
    fontSize: "12px",
    marginTop: "2px",
  },
  alertTime: {
    fontSize: "12px",
    marginTop: "4px",
    fontWeight: 500,
  },
};

export default NotificationBell;