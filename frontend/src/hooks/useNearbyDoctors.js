// frontend/src/hooks/useNearbyDoctors.js
import { useState, useEffect } from "react";

export const useNearbyDoctors = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError("Unable to retrieve your location: " + err.message);
        setLoading(false);
      }
    );
  };

  return { location, error, loading, getLocation };
};

/**
 * Given a list of doctors (from your DB) each having { location: { lat, lng } },
 * compute distance in km using Haversine formula and sort by nearest.
 */
export const sortDoctorsByDistance = (doctors, userLat, userLng) => {
  const toRad = (val) => (val * Math.PI) / 180;

  return doctors
    .map((doc) => {
      if (!doc.location?.lat || !doc.location?.lng) {
        return { ...doc, distance: Infinity };
      }
      const R = 6371; // Earth radius in km
      const dLat = toRad(doc.location.lat - userLat);
      const dLng = toRad(doc.location.lng - userLng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(userLat)) *
          Math.cos(toRad(doc.location.lat)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return { ...doc, distance: parseFloat(distance.toFixed(1)) };
    })
    .sort((a, b) => a.distance - b.distance);
};