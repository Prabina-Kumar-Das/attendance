import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import API_BASE from "../../../config/api";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ShieldAlert, ShieldCheck, MapPin, Clock, Server,
  UserCheck, X, CheckCircle, AlertTriangle, Wifi, LogOut
} from "lucide-react";

// Fix default Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom blue marker for user location
const userIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Helper component to recenter map when user location changes
const RecenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
};

// Haversine formula to calculate distance in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const DashboardEmployee = () => {
  // Geofence config
  const [masterGeofence, setMasterGeofence] = useState({ lat: 20.2961, lng: 85.8245, radius: 200, name: "Master Campus" });
  const geofenceRef = useRef({ lat: 20.2961, lng: 85.8245, radius: 200 });

  // Load user from localStorage - also set ref immediately (not just in useEffect)
  const storedUserRaw = localStorage.getItem("user");
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  const [currentUser, setCurrentUser] = useState(storedUser || { name: "Employee", email: "", role: "" });
  const userEmailRef = useRef(storedUser?.email || "");
  // Geolocation and Geofence State
  const [userLocation, setUserLocation] = useState({ lat: 20.2961, lng: 85.8245 });
  const [isInside, setIsInside] = useState(true);
  const isInsideRef = useRef(true);
  const [distanceFromCenter, setDistanceFromCenter] = useState(0);

  // Modal and UI State
  const [isBreached, setIsBreached] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]); // 4-digit OTP
  const [currentDate, setCurrentDate] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationSource, setLocationSource] = useState("");

  // Real API state
  const [alertId, setAlertId] = useState(null);
  const [countdown, setCountdown] = useState(300);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(""); // "success" | "error" | ""

  // Punch-In state
  const [punchInTime, setPunchInTime] = useState(null);
  const [punchInLocation, setPunchInLocation] = useState("Not punched in");
  const [isPunchedIn, setIsPunchedIn] = useState(false);

  // Activity Log
  const [activityLog, setActivityLog] = useState([]);

  // Update Profile modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({ name: "", email: "", employeeId: "", role: "", password: "" });
  const [updateStatus, setUpdateStatus] = useState(""); // "" | "pending" | "success" | "error" | "already"
  const [updateMsg, setUpdateMsg] = useState("");
  const [showUpdatePwd, setShowUpdatePwd] = useState(false);

  // Leave Request modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ requestType: "Full Day Leave", startDate: "", endDate: "", reason: "" });
  const [leaveStatus, setLeaveStatus] = useState("");
  const [leaveMsg, setLeaveMsg] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);

  const isOnApprovedLeave = React.useMemo(() => {
    return leaveRequests.some(req => {
      if (req.status !== "Approved") return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(req.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.endDate);
      end.setHours(0, 0, 0, 0);
      return today >= start && today <= end;
    });
  }, [leaveRequests]);

  const isOnApprovedLeaveRef = useRef(false);
  useEffect(() => {
    isOnApprovedLeaveRef.current = isOnApprovedLeave;
  }, [isOnApprovedLeave]);

  // Keep user state in sync if localStorage changes after mount
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCurrentUser(parsed);
        userEmailRef.current = parsed.email;
      } catch {
        console.warn("Could not parse stored user.");
      }
    }
  }, []);

  // Submit profile update request to admin
  const submitUpdateRequest = async (e) => {
    e.preventDefault();
    setUpdateStatus("pending");
    setUpdateMsg("");
    try {
      const email = userEmailRef.current || JSON.parse(localStorage.getItem("user") || "{}").email;
      if (!email) { setUpdateStatus("error"); setUpdateMsg("Not logged in."); return; }
      const payload = { email, ...updateForm };
      // Remove empty fields
      Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
      await axios.post(`${API_BASE}/api/update-request`, payload);
      setUpdateStatus("success");
      setUpdateMsg("Request sent! Awaiting admin approval.");
      addActivity("📋 Profile Update Requested", "Waiting for admin to approve changes");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to submit request";
      setUpdateStatus(err.response?.status === 409 ? "already" : "error");
      setUpdateMsg(msg);
    }
  };

  // Fetch leave requests for employee
  useEffect(() => {
    const fetchLeaves = async () => {
      const email = userEmailRef.current || JSON.parse(localStorage.getItem("user") || "{}").email;
      if (email) {
        try {
          const res = await axios.get(`${API_BASE}/api/employee/leave-requests/${email}`);
          setLeaveRequests(res.data);
        } catch (e) { console.error("Error fetching leave requests", e); }
      }
    };
    fetchLeaves();
    const id = setInterval(fetchLeaves, 8000);
    return () => clearInterval(id);
  }, []);

  const submitLeaveRequest = async (e) => {
    e.preventDefault();
    setLeaveStatus("pending");
    setLeaveMsg("");
    try {
      const email = userEmailRef.current || JSON.parse(localStorage.getItem("user") || "{}").email;
      if (!email || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
        setLeaveStatus("error"); setLeaveMsg("Please fill all required fields."); return;
      }
      await axios.post(`${API_BASE}/api/leave-request`, { email, ...leaveForm });
      setLeaveStatus("success");
      setLeaveMsg("Leave request submitted successfully.");
      addActivity("📅 Leave Requested", `${leaveForm.requestType} requested.`);
      // Refetch
      const res = await axios.get(`${API_BASE}/api/employee/leave-requests/${email}`);
      setLeaveRequests(res.data);
      setTimeout(() => setShowLeaveModal(false), 2000);
    } catch (err) {
      setLeaveStatus("error");
      setLeaveMsg(err.response?.data?.message || "Failed to submit leave request.");
    }
  };

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleString("en-IN", {
          month: "long", day: "numeric", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: true,
        }).toUpperCase()
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown timer when breach is active
  useEffect(() => {
    if (!isBreached) return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [isBreached, countdown]);

  // Update isInsideRef whenever state changes (to avoid stale closure)
  useEffect(() => {
    isInsideRef.current = isInside;
  }, [isInside]);

  // Core location update function
  const updateLocation = async (latitude, longitude, source) => {
    setUserLocation({ lat: latitude, lng: longitude });
    setLocationLoading(false);
    setLocationError("");
    setLocationSource(source);

    const distance = calculateDistance(
      geofenceRef.current.lat,
      geofenceRef.current.lng,
      latitude,
      longitude
    );
    setDistanceFromCenter(Math.round(distance));

    const outside = distance > geofenceRef.current.radius;

    if (isOnApprovedLeaveRef.current) {
      if (!isInsideRef.current) {
        isInsideRef.current = true;
        setIsInside(true);
      }
    } else if (outside) {
      if (isInsideRef.current) {
        // Just crossed the boundary — trigger breach!
        isInsideRef.current = false;
        setIsInside(false);
        setIsBreached(true);
        addActivity("🚨 Geofence Boundary Exited", "Security verification required");
        await triggerBreach(latitude, longitude);
      }
    } else {
      if (!isInsideRef.current) {
        addActivity("✅ Returned Inside Geofence", "Back within campus perimeter");
      }
      isInsideRef.current = true;
      setIsInside(true);
    }

    // Push location to server (non-blocking, best-effort)
    // Always read fresh email from localStorage to avoid race condition
    const freshUser = JSON.parse(localStorage.getItem("user") || "{}");
    const emailToSend = freshUser.email || userEmailRef.current;
    if (emailToSend) {
      axios.post(`${API_BASE}/api/location`, {
        email: emailToSend,
        lat: latitude,
        lng: longitude,
        status: isOnApprovedLeaveRef.current ? "On Leave" : (outside ? "Outside" : "Inside"),
        punchInTime: punchInTime || "-",
        punchInLocation: punchInLocation,
      }).catch((e) => {
        if (e.response?.status === 404) {
          console.warn("⚠️ Location: User not found in DB. Please log in.");
        }
      });
    }
  };

  const triggerBreach = async (lat, lng) => {
    // Always read fresh from localStorage to avoid stale ref race condition
    const freshUser = JSON.parse(localStorage.getItem("user") || "{}");
    const email = freshUser.email || userEmailRef.current;
    if (!email) {
      console.warn("⚠️ Cannot trigger breach: No logged-in user email found.");
      return;
    }
    userEmailRef.current = email; // keep ref in sync
    setCountdown(300);
    try {
      const res = await axios.post(`${API_BASE}/api/breach-trigger`, {
        email,
        lat,
        lng,
      });
      console.log(`📧 Breach alert and OTP email dispatched to: ${email}`);
      if (res.data.alertId) setAlertId(res.data.alertId);
      if (res.data.expiresAt) {
        const diff = Math.floor((new Date(res.data.expiresAt) - new Date()) / 1000);
        if (diff > 0) setCountdown(diff);
      }
    } catch (e) {
      if (e.response?.status === 404) {
        console.warn(`⚠️ Breach trigger: User '${email}' not found in Database.`);
      } else {
        console.error("Failed to trigger breach:", e);
      }
    }
  };

  // OTP Keypad handler
  const handleKeypad = (val) => {
    if (val === "DEL") {
      const copy = [...otpDigits];
      for (let i = 3; i >= 0; i--) {
        if (copy[i] !== "") { copy[i] = ""; break; }
      }
      setOtpDigits(copy);
    } else {
      const idx = otpDigits.findIndex((v) => v === "");
      if (idx !== -1) {
        const copy = [...otpDigits];
        copy[idx] = val.toString();
        setOtpDigits(copy);
      }
    }
    setVerifyStatus("");
  };

  // Verify OTP against backend
  const verifyOTP = async () => {
    const fullOtp = otpDigits.join("");
    if (fullOtp.length < 4) return;
    setIsVerifying(true);
    setVerifyStatus("");
    try {
      await axios.post(`${API_BASE}/api/verify-breach`, {
        email: userEmailRef.current,
        otp: fullOtp,
        alertId,
      });
      setVerifyStatus("success");
      addActivity("✅ Security Verified", "OTP verified successfully, monitoring reset");
      setTimeout(() => {
        setIsBreached(false);
        setOtpDigits(["", "", "", ""]);
        setVerifyStatus("");
        setIsInside(true);
        isInsideRef.current = true;
      }, 1500);
    } catch {
      setVerifyStatus("error");
      setTimeout(() => {
        setOtpDigits(["", "", "", ""]);
        setVerifyStatus("");
      }, 1200);
    } finally {
      setIsVerifying(false);
    }
  };

  const addActivity = (title, detail) => {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    setActivityLog((prev) => [{ title, detail, time }, ...prev.slice(0, 9)]);
  };

  // Punch In / Out
  const handlePunchIn = () => {
    if (isPunchedIn) {
      // Punch Out is always allowed from anywhere
      setPunchInTime(null);
      setIsPunchedIn(false);
      setPunchInLocation("Not punched in");
      addActivity("🔴 Punched Out", `Work session ended at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`);
    } else {
      // Punch In is ONLY allowed inside the geofence
      if (!isInside) {
        addActivity("⛔ Punch-In Blocked", "You must be inside campus to punch in");
        return;
      }
      if (locationLoading) {
        addActivity("⏳ Punch-In Blocked", "Location is still being acquired");
        return;
      }
      const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      const coords = `${userLocation.lat.toFixed(4)}°N, ${userLocation.lng.toFixed(4)}°E`;
      setPunchInTime(now);
      setIsPunchedIn(true);
      setPunchInLocation(`Main Campus · ${coords}`);
      addActivity("🟢 Punched In", `At ${now} — Inside campus perimeter`);
    }
  };

  // IP-based location fallback
  const getLocationFromIP = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      if (data.latitude && data.longitude) {
        updateLocation(data.latitude, data.longitude, `IP (${data.city}, ${data.region})`);
      } else {
        setLocationError("Could not determine location from IP.");
        setLocationLoading(false);
      }
    } catch {
      setLocationError("All location methods failed.");
      setLocationLoading(false);
    }
  };

  // Fetch geofence + start watching location
  useEffect(() => {
    axios.get(`${API_BASE}/geofence`).then((res) => {
      if (res.data) {
        setMasterGeofence(res.data);
        geofenceRef.current = res.data;
      }
    }).catch(console.error);

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        ({ coords: { latitude, longitude, accuracy } }) => {
          if (accuracy > 5000) {
            getLocationFromIP();
          } else {
            updateLocation(latitude, longitude, `GPS (±${Math.round(accuracy)}m)`);
          }
        },
        () => getLocationFromIP(),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      getLocationFromIP();
    }
  }, []);

  const fmtCountdown = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans relative overflow-x-hidden">

      {/* ── HEADER ── */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-5 flex justify-between items-center border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-blue-600">
            <ShieldCheck size={26} />
            <h1 className="font-extrabold text-xl tracking-tight text-gray-800 leading-none">
              SECURE<br />TRACK
            </h1>
          </div>
          <div className="h-8 w-px bg-gray-300" />
          <h2 className="font-semibold text-gray-700">Employee Portal</h2>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-sm">
              {currentUser.name ? currentUser.name[0].toUpperCase() : "E"}
            </div>
            <div>
              <p className="font-bold text-sm text-gray-800 uppercase leading-none">{currentUser.name || "Employee"}</p>
              <p className="text-xs text-gray-500">{currentUser.role || "Staff"}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-gray-700 uppercase">{currentDate || "LOADING..."}</p>
            <p className="text-gray-500 flex items-center justify-end gap-1 mt-0.5">
              System:&nbsp;
              <span className={`px-2 py-0.5 rounded-sm font-bold text-[10px] ${isInside ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700 animate-pulse"}`}>
                {isInside ? "SECURE" : "ALERT"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 transition-all duration-300 ${isBreached ? "blur-sm pointer-events-none select-none" : ""}`}>

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Punch-In Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Punch-In Summary</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold">Punch-In Time</p>
                <p className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" />
                  {punchInTime || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold">Punch-In Location</p>
                <p className="font-bold text-sm text-gray-800 flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500" />
                  {punchInLocation}
                </p>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {locationLoading ? (
                  <span className="text-yellow-600 font-bold">⏳ Acquiring location...</span>
                ) : locationError ? (
                  <span className="text-red-500 font-bold">⚠️ {locationError}</span>
                ) : (
                  <>
                    <span>📍 {userLocation.lat.toFixed(5)}°N, {userLocation.lng.toFixed(5)}°E</span>
                    <br />
                    <span className="text-blue-400 text-[10px]">Source: {locationSource}</span>
                    <br />
                    <span className={`font-bold text-[10px] ${isInside ? "text-green-600" : "text-red-600"}`}>
                      Distance from center: {distanceFromCenter}m (Boundary: {geofenceRef.current.radius}m)
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={handlePunchIn}
                disabled={(!isPunchedIn && (!isInside || locationLoading || isOnApprovedLeave)) || (isPunchedIn && isOnApprovedLeave)}
                title={!isPunchedIn && !isInside ? "You must be inside the campus geofence to punch in" : isOnApprovedLeave ? "You are on an approved leave" : ""}
                className={`w-full py-2 rounded-lg font-bold text-sm uppercase tracking-wider transition-all
                  ${isOnApprovedLeave
                    ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                    : isPunchedIn
                      ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                      : (!isInside || locationLoading)
                        ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  }`}
              >
                {isOnApprovedLeave
                  ? "🏖️ On Leave"
                  : isPunchedIn
                    ? "🔴 Punch Out"
                    : locationLoading
                      ? "⏳ Acquiring Location..."
                      : !isInside
                        ? "🔒 Outside Campus — Cannot Punch In"
                        : "🟢 Punch In"}
              </button>
            </div>
          </div>

          {/* Geofence Map */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col" style={{ height: "320px" }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Geofence Monitor</h3>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${isInside ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700 animate-pulse"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isInside ? "bg-green-500" : "bg-red-500"}`} />
                {isInside ? "INSIDE" : "BREACH"}
              </div>
            </div>
            <div className="flex-1 rounded-lg overflow-hidden border border-gray-200">
              <MapContainer
                center={[userLocation.lat, userLocation.lng]}
                zoom={15}
                style={{ width: "100%", height: "100%" }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap position={[userLocation.lat, userLocation.lng]} />
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                  <Popup>📍 You are here<br />{userLocation.lat.toFixed(4)}°N, {userLocation.lng.toFixed(4)}°E</Popup>
                </Marker>
                <Circle
                  center={[masterGeofence.lat, masterGeofence.lng]}
                  radius={masterGeofence.radius}
                  pathOptions={{
                    fillColor: isInside ? "#3b82f6" : "#ef4444",
                    fillOpacity: 0.12,
                    color: isInside ? "#3b82f6" : "#ef4444",
                    opacity: 0.8,
                    weight: 2.5,
                  }}
                />
              </MapContainer>
            </div>
          </div>
        </div>

        {/* ── MIDDLE COLUMN ── */}
        <div className="space-y-5">

          {/* Approved Leave Banner */}
          {isOnApprovedLeave && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏖️</span>
                <div>
                  <h3 className="text-sm font-black text-teal-800">You are on an Approved Leave</h3>
                  <p className="text-xs text-teal-600">Location tracking and geofence alerts are disabled for today.</p>
                </div>
              </div>
            </div>
          )}

          {/* Status Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Live Status</h3>
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${isInside ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">GEOFENCE STATUS</span>
                  <span className={`text-xs font-black uppercase ${isInside ? "text-green-600" : "text-red-600 animate-pulse"}`}>
                    {isInside ? "✓ Inside Perimeter" : "✗ Breached"}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">WORK STATUS</span>
                  <span className={`text-xs font-black uppercase ${isPunchedIn ? "text-blue-600" : "text-gray-400"}`}>
                    {isPunchedIn ? "Active Session" : "Not Punched In"}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                <p className="text-xs font-bold text-gray-600 mb-1">PROXIMITY</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${isInside ? "bg-blue-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, (distanceFromCenter / (geofenceRef.current.radius * 1.5)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{distanceFromCenter}m from center · {geofenceRef.current.radius}m limit</p>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Activity Log</h3>
            {activityLog.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No activity yet</p>
            ) : (
              <div className="relative border-l border-gray-200 ml-2 space-y-4">
                {activityLog.map((item, i) => (
                  <div key={i} className="relative pl-5">
                    <div className="absolute w-2.5 h-2.5 bg-blue-500 rounded-full -left-1.25 top-0.5 border-2 border-white" style={{ left: "-5px" }} />
                    <p className="text-xs font-bold text-gray-800">{item.title}</p>
                    <p className="text-[11px] text-gray-500">{item.detail}</p>
                    <p className="text-[10px] text-gray-400">{item.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* Profile Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Profile</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                {currentUser.name ? currentUser.name[0].toUpperCase() : "?"}
              </div>
              <div>
                <p className="font-bold text-gray-800">{currentUser.name || "Employee"}</p>
                <p className="text-xs text-gray-500">{currentUser.email || "Not logged in"}</p>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                  {currentUser.role || "Staff"}
                </span>
              </div>
            </div>
            <button
              onClick={() => { setShowUpdateModal(true); setUpdateStatus(""); setUpdateMsg(""); setUpdateForm({ name: currentUser.name || "", email: currentUser.email || "", employeeId: "", role: currentUser.role || "", password: "" }); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors mb-2"
            >
              ✏️ Request Profile Update
            </button>
            <button
              onClick={() => { setShowLeaveModal(true); setLeaveStatus(""); setLeaveMsg(""); setLeaveForm({ requestType: "Full Day Leave", startDate: "", endDate: "", reason: "" }); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors mb-2"
            >
              📅 Request Leave / Special
            </button>
            <button
              onClick={() => { localStorage.removeItem("user"); window.location.href = "/"; }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>

          {/* Secure Connection */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Secure Connection</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-600 text-xs"><Server size={14} /> Main Server Sync:</span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVE</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-600 text-xs"><ShieldCheck size={14} /> OTP Service:</span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">READY</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-600 text-xs"><Wifi size={14} /> GPS Tracking:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${locationLoading ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                  {locationLoading ? "ACQUIRING" : "LIVE"}
                </span>
              </li>
              <li className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-600 text-xs"><UserCheck size={14} /> Admin System:</span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">CONNECTED</span>
              </li>
            </ul>
          </div>

          {/* Geofence Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Campus Geofence</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><span className="font-bold">Zone:</span> {masterGeofence.name}</p>
              <p><span className="font-bold">Center:</span> {masterGeofence.lat?.toFixed(4)}°N, {masterGeofence.lng?.toFixed(4)}°E</p>
              <p><span className="font-bold">Radius:</span> {masterGeofence.radius}m</p>
              <p><span className="font-bold">Alert:</span> Email + Admin Dashboard</p>
            </div>
          </div>

          {/* Leave History Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Leave History</h3>
            {leaveRequests.length === 0 ? (
              <p className="text-xs text-gray-400">No leave requests yet.</p>
            ) : (
              <div className="space-y-3">
                {leaveRequests.slice(0, 3).map(req => (
                  <div key={req._id} className="border border-gray-100 p-2 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-800">{req.requestType}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${req.status === "Pending" ? "bg-amber-100 text-amber-700" : req.status === "Approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{req.status}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</p>
                  </div>
                ))}
                {leaveRequests.length > 3 && <p className="text-[10px] text-blue-500 text-center font-bold">+{leaveRequests.length - 3} older requests hidden</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── UPDATE PROFILE MODAL ── */}
      {showUpdateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-40 px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowUpdateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 p-6 z-10">
            <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1" onClick={() => setShowUpdateModal(false)}>
              <X size={16} />
            </button>

            <div className="mb-5">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Request Profile Update</h2>
              <p className="text-xs text-gray-500 mt-1">Fill in the fields you want to change. Your request will be sent to the admin for approval.</p>
            </div>

            {/* Status Banner */}
            {updateMsg && (
              <div className={`mb-4 p-3 rounded-lg text-xs font-semibold border ${updateStatus === "success" ? "bg-green-50 border-green-200 text-green-700" :
                  updateStatus === "already" ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                    "bg-red-50 border-red-200 text-red-700"
                }`}>
                {updateMsg}
              </div>
            )}

            <form onSubmit={submitUpdateRequest} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="New name"
                    value={updateForm.name}
                    onChange={e => setUpdateForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="New email"
                    value={updateForm.email}
                    onChange={e => setUpdateForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-1234"
                    value={updateForm.employeeId}
                    onChange={e => setUpdateForm(p => ({ ...p, employeeId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Role</label>
                  <select
                    value={updateForm.role}
                    onChange={e => setUpdateForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
                  >
                    <option value="">-- No change --</option>
                    <optgroup label="Employee Roles">
                      <option value="developer">Developer</option>
                      <option value="manager">Manager</option>
                      <option value="designer">Designer</option>
                      <option value="hr">HR</option>
                      <option value="analyst">Analyst</option>
                      <option value="intern">Intern</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">New Password <span className="text-gray-400 font-normal normal-case">(leave blank to keep current)</span></label>
                <div className="relative">
                  <input
                    type={showUpdatePwd ? "text" : "password"}
                    placeholder="New password (optional)"
                    value={updateForm.password}
                    onChange={e => setUpdateForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 pr-10"
                  />
                  <button type="button" onClick={() => setShowUpdatePwd(v => !v)} className="absolute inset-y-0 right-3 text-gray-400 hover:text-gray-600 flex items-center">
                    {showUpdatePwd ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateStatus === "pending" || updateStatus === "success"}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${updateStatus === "success" ? "bg-green-500 text-white" :
                      updateStatus === "pending" ? "bg-gray-200 text-gray-400" :
                        "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                    }`}
                >
                  {updateStatus === "pending" ? "Sending..." : updateStatus === "success" ? "✓ Request Sent!" : "Send Request to Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LEAVE REQUEST MODAL ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 flex items-center justify-center z-40 px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowLeaveModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 p-6 z-10">
            <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1" onClick={() => setShowLeaveModal(false)}>
              <X size={16} />
            </button>

            <div className="mb-5">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Request Leave / Special Off</h2>
              <p className="text-xs text-gray-500 mt-1">Submit your form. It will be reviewed by an administrator.</p>
            </div>

            {/* Status Banner */}
            {leaveMsg && (
              <div className={`mb-4 p-3 rounded-lg text-xs font-semibold border ${leaveStatus === "success" ? "bg-green-50 border-green-200 text-green-700" :
                  "bg-red-50 border-red-200 text-red-700"
                }`}>
                {leaveMsg}
              </div>
            )}

            <form onSubmit={submitLeaveRequest} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Request Type</label>
                <select
                  value={leaveForm.requestType}
                  onChange={e => setLeaveForm({ ...leaveForm, requestType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white"
                >
                  <option value="Full Day Leave">Full Day Leave</option>
                  <option value="Half Day Leave">Half Day Leave</option>
                  <option value="Work from Home">Work from Home</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Reason</label>
                <textarea
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  rows={3}
                  placeholder="Provide a reason for your request..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaveStatus === "pending" || leaveStatus === "success"}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${leaveStatus === "success" ? "bg-green-500 text-white" :
                      leaveStatus === "pending" ? "bg-gray-200 text-gray-400" :
                        "bg-teal-600 hover:bg-teal-700 text-white shadow-md"
                    }`}
                >
                  {leaveStatus === "pending" ? "Sending..." : leaveStatus === "success" ? "✓ Request Sent!" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BREACH VERIFICATION MODAL ── */}
      {isBreached && (
        <div className="fixed inset-0 flex items-start justify-center z-50 pt-10 px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 flex flex-col items-center text-center p-7 z-10">

            {/* Close button (dismiss only, doesn't clear breach) */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1"
              onClick={() => setIsBreached(false)}
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-60" />
              <div className="relative bg-white p-3 rounded-full shadow border border-red-100">
                <ShieldAlert size={38} className="text-red-500" />
              </div>
            </div>

            <h2 className="text-base font-black text-gray-900 uppercase tracking-widest mb-1">URGENT: SECURITY ALERT</h2>

            <p className="text-xs text-gray-500 mb-4 px-2 leading-relaxed">
              Your device moved beyond the campus geofence boundary. An encrypted OTP has been sent to <strong>{currentUser.email || "your registered email"}</strong>.
            </p>

            {/* Countdown */}
            <div className={`px-4 py-2 rounded-lg mb-5 font-black text-base tracking-wider ${countdown <= 60 ? "bg-red-100 text-red-600" : "bg-orange-50 text-orange-600"}`}>
              ⏱ Time Remaining: {fmtCountdown(countdown)}
            </div>
            {countdown === 0 && (
              <p className="text-xs text-red-600 font-bold mb-3 animate-pulse">⚠ Time expired — Admin has been notified!</p>
            )}

            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Enter 4-Digit OTP</p>

            {/* OTP Boxes */}
            <div className="flex gap-3 justify-center mb-4">
              {otpDigits.map((digit, index) => (
                <div
                  key={index}
                  className={`w-11 h-13 border-2 rounded-lg flex items-center justify-center text-xl font-black transition-all
                    ${verifyStatus === "error" ? "border-red-400 bg-red-50 text-red-600" : ""}
                    ${verifyStatus === "success" ? "border-green-400 bg-green-50 text-green-600" : ""}
                    ${!verifyStatus ? (digit ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-800") : ""}
                  `}
                  style={{ height: "52px" }}
                >
                  {verifyStatus === "success" ? "✓" : verifyStatus === "error" ? "✗" : digit || ""}
                </div>
              ))}
            </div>

            {/* Verify Button */}
            <button
              onClick={verifyOTP}
              disabled={isVerifying || otpDigits.join("").length < 4 || verifyStatus === "success"}
              className={`w-full py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all mb-4
                ${verifyStatus === "success" ? "bg-green-500 text-white" : ""}
                ${verifyStatus === "error" ? "bg-red-500 text-white" : ""}
                ${!verifyStatus ? (isVerifying || otpDigits.join("").length < 4 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-800 hover:bg-black text-white shadow-md") : ""}
              `}
            >
              {isVerifying ? "Verifying..." : verifyStatus === "success" ? "✓ Verified!" : verifyStatus === "error" ? "✗ Invalid OTP" : "Verify Possession"}
            </button>

            {/* Keypad */}
            <div className="bg-gray-100 p-3 rounded-xl w-full">
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeypad(num)}
                    className="bg-white py-2.5 rounded-lg shadow-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-95 border border-gray-200 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button onClick={() => handleKeypad(0)} className="bg-white py-2.5 rounded-lg shadow-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-95 border border-gray-200 transition-all">
                  0
                </button>
                <button onClick={() => handleKeypad("DEL")} className="bg-white py-2.5 rounded-lg shadow-sm text-gray-700 hover:bg-red-50 hover:text-red-600 active:scale-95 border border-gray-200 transition-all font-bold">
                  ⌫
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardEmployee;