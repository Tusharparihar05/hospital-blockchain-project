import React, { useState } from "react";
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, isSameDay, isSameMonth } from "date-fns";

export default function AvailabilityCalendar({ value, onChange }) {
  const [view, setView] = useState("week");
  const [current, setCurrent] = useState(new Date());
  const slots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
  ];

  const getDays = () => {
    if (view === "week") {
      const start = startOfWeek(current, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      const start = startOfMonth(current);
      const end = endOfMonth(current);
      const days = [];
      let d = start;
      while (d <= end) {
        days.push(d);
        d = addDays(d, 1);
      }
      return days;
    }
  };

  const days = getDays();
  const selected = value || {};

  function toggleSlot(day, slot) {
    const key = format(day, "yyyy-MM-dd");
    const daySlots = selected[key] || [];
    const exists = daySlots.includes(slot);
    const newSlots = exists ? daySlots.filter(s => s !== slot) : [...daySlots, slot];
    onChange({ ...selected, [key]: newSlots });
  }

  return (
    <div style={{ background: "#101d30", borderRadius: 14, padding: 18, border: "1px solid #172035" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <button onClick={() => setView(view === "week" ? "month" : "week")}
            style={{ background: "#0c1424", color: "#00c8a0", border: "1px solid #00c8a033", borderRadius: 8, padding: "4px 12px", marginRight: 10 }}>
            {view === "week" ? "Month View" : "Week View"}
          </button>
          <span style={{ color: "#dde6f5", fontWeight: 700, fontSize: 15 }}>{view === "week" ? "This Week" : format(current, "MMMM yyyy")}</span>
        </div>
        <div>
          <button onClick={() => setCurrent(addDays(current, view === "week" ? -7 : -30))} style={{ marginRight: 6 }}>◀</button>
          <button onClick={() => setCurrent(new Date())} style={{ marginRight: 6 }}>Today</button>
          <button onClick={() => setCurrent(addDays(current, view === "week" ? 7 : 30))}>▶</button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ color: "#7a92b8", fontWeight: 700, fontSize: 13, padding: 6 }}></th>
              {days.map(day => (
                <th key={format(day, "yyyy-MM-dd")}
                  style={{ color: isSameDay(day, new Date()) ? "#00c8a0" : "#dde6f5", fontWeight: 700, fontSize: 13, padding: 6, background: isSameDay(day, new Date()) ? "#00c8a01a" : "inherit" }}>
                  {format(day, "EEE dd")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => (
              <tr key={slot}>
                <td style={{ color: "#dde6f5", fontWeight: 600, fontSize: 13, padding: 6 }}>{slot}</td>
                {days.map(day => {
                  const key = format(day, "yyyy-MM-dd");
                  const isSelected = (selected[key] || []).includes(slot);
                  return (
                    <td key={key + slot} style={{ textAlign: "center", padding: 4 }}>
                      <button
                        onClick={() => toggleSlot(day, slot)}
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: isSelected ? "#00c8a0" : "#172035",
                          color: isSelected ? "#fff" : "#7a92b8",
                          border: isSelected ? "1.5px solid #00c8a0" : "1px solid #172035",
                          fontWeight: 700, fontSize: 13, cursor: "pointer"
                        }}
                        title={format(day, "yyyy-MM-dd") + " " + slot}
                      >
                        {isSelected ? "✔" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
