import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LayoutDashboard, Users, Map, ShieldAlert, Bell, Settings,
  Search, Filter, Server, Activity, ChevronDown, LogOut,
  User, Eye, Check, X, Clock, MapPin, Wifi, RefreshCw,
  AlertTriangle, CheckCircle, TrendingUp, Smartphone, Plus, Trash2, Calendar
} from "lucide-react";
import axios from "axios";
import API_BASE from "../../../config/api";

// ─── Fix Leaflet default marker ───────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;

const makeIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  });

const safeIcon  = makeIcon("green");
const alertIcon = makeIcon("red");
const warnIcon  = makeIcon("orange");

// Navigation
const NAV_ITEMS = [
  { key: "dashboard",       label: "Dashboard",       Icon: LayoutDashboard },
  { key: "employees",       label: "Employees",       Icon: Users           },
  { key: "livemaps",        label: "Live Maps",       Icon: Map             },
  { key: "geofences",       label: "Geofences",       Icon: ShieldAlert     },
  { key: "alerts",          label: "Alerts",          Icon: Bell            },
  { key: "updaterequests",  label: "Update Requests", Icon: CheckCircle     },
  { key: "leaverequests",   label: "Leave Requests",  Icon: Calendar        },
  { key: "settings",        label: "Settings",        Icon: Settings        },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (s) => {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const StatCard = ({ icon: Icon, iconBg, iconColor, label, value, valueColor, pulse }) => (
  <div className={`bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-1 relative overflow-hidden ${pulse ? "ring-1 ring-red-300" : ""}`}>
    {pulse && <span className="absolute top-0 right-0 w-2 h-full bg-red-500 animate-pulse"/>}
    <div className={`flex items-center gap-2 ${iconBg} ${iconColor} w-fit px-2 py-1 rounded text-xs font-bold mb-1`}>
      <Icon size={13}/> <span>{label}</span>
    </div>
    <p className={`text-2xl font-black tracking-tight ${valueColor || "text-gray-800"}`}>{value}</p>
  </div>
);

const AlertCard = ({ alert, onDismiss, onResolve }) => {
  const isAlarm    = alert.type === "alarm";
  const isResolved = alert.type === "resolved";
  return (
    <div className={`rounded-lg p-3 border-l-4 text-xs relative ${
      isAlarm    ? "bg-red-50 border-red-500" :
      isResolved ? "bg-green-50 border-green-500" :
                   "bg-blue-50 border-blue-400"
    }`}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5">
          {isAlarm    && <span className="font-black text-red-600 uppercase text-[10px] tracking-wider">ALARM:</span>}
          {isResolved && <span className="font-black text-green-600 uppercase text-[10px] tracking-wider">RESOLVED:</span>}
          {!isAlarm && !isResolved && <span className="font-black text-blue-600 uppercase text-[10px] tracking-wider">INFO:</span>}
          <span className="font-bold text-gray-800">{alert.event}</span>
        </div>
        <button onClick={() => onDismiss(alert.id)} className="text-gray-400 hover:text-gray-600 ml-2"><X size={12}/></button>
      </div>
      <p className="text-gray-600 leading-relaxed">
        Employee <span className="font-bold text-gray-800">'{alert.user}'</span>
        {alert.empId && <span className="text-gray-500"> ({alert.empId})</span>}
        {" — "}{alert.detail}
      </p>
      {isAlarm && alert.countdown > 0 && (
        <p className="font-bold text-red-600 mt-1">{fmt(alert.countdown)} remaining.</p>
      )}
      {isAlarm && (
        <button
          onClick={() => onResolve(alert.id)}
          className="mt-2 flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 hover:bg-green-200 px-2 py-0.5 rounded transition-colors"
        >
          <Check size={10}/> Mark Resolved
        </button>
      )}
    </div>
  );
};

const DashboardAdmin = () => {
  const [activeNav,      setActiveNav]      = useState("dashboard");
  const [mapEnabled,     setMapEnabled]     = useState(true);
  const [alerts,         setAlerts]         = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [allEmployeesDB, setAllEmployeesDB] = useState([]);
  const [geofences,      setGeofences]      = useState([]);
  
  const [stats, setStats] = useState({ totalEmployees: 0, totalGeofences: 0, otpSentToday: 0, activeDevices: 0, activeBreaches: 0 });
  
  const [searchQuery,    setSearchQuery]    = useState("");
  const [statusFilter,   setStatusFilter]   = useState("All");
  const [clockStr,       setClockStr]       = useState("");
  const [showBell,       setShowBell]       = useState(false);
  const [showAdmin,      setShowAdmin]      = useState(false);

  const [updateRequests, setUpdateRequests] = useState([]);
  const bellRef  = useRef(null);
  const adminRef = useRef(null);
  
  // Geofence Modal
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [editGeofence, setEditGeofence] = useState({ name: "", lat: 20.2961, lng: 85.8245, radius: 200, color: "#3b82f6", description: "" });

  const [leaveRequests, setLeaveRequests] = useState([]);

  // Core Data Fetching
  const fetchGeofences = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/geofences`);
      setGeofences(res.data);
    } catch (e) { console.error("Failed to fetch geofences:", e); }
  };

  const fetchEmployeesLive = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/employee-locations`);
      setEmployees(res.data);
    } catch (e) { console.error("Failed to fetch live locations:", e); }
  };

  const fetchAllEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees`);
      setAllEmployeesDB(res.data);
    } catch (e) { console.error("Failed to fetch employees:", e); }
  };

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/alerts`);
      setAlerts(res.data);
    } catch (e) { console.error("Failed to fetch alerts:", e); }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/stats`);
      setStats(res.data);
    } catch (e) { console.error("Failed to fetch stats:", e); }
  };

  const fetchUpdateReqs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/update-requests`);
      setUpdateRequests(res.data);
    } catch (e) { console.error("Failed to fetch update requests:", e); }
  };

  const fetchLeaveReqs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/leave-requests`);
      setLeaveRequests(res.data);
    } catch (e) { console.error("Failed to fetch leave requests:", e); }
  };

  // Initial and Polling setup
  useEffect(() => {
    fetchGeofences();
    fetchAllEmployees();
  }, []);

  useEffect(() => {
    fetchEmployeesLive();
    fetchAlerts();
    fetchStats();
    fetchUpdateReqs();
    fetchLeaveReqs();
    const id = setInterval(() => {
      fetchEmployeesLive();
      fetchAlerts();
      fetchStats();
      fetchUpdateReqs();
      fetchLeaveReqs();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClockStr(d.toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current  && !bellRef.current.contains(e.target))  setShowBell(false);
      if (adminRef.current && !adminRef.current.contains(e.target)) setShowAdmin(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dismissAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id));
  
  const resolveAlert = async (id) => {
    try {
      await axios.put(`${API_BASE}/api/admin/alerts/${id}/resolve`);
      fetchAlerts();
      fetchStats();
    } catch (e) {
      console.error("Failed to resolve alert", e);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    try {
      await axios.delete(`${API_BASE}/api/employees/${id}`);
      fetchAllEmployees();
      fetchStats();
    } catch(e) { console.error("Error deleting employee", e); }
  };

  const handleDeleteGeofence = async (id) => {
    if (!window.confirm("Are you sure you want to delete this geofence?")) return;
    try {
      await axios.delete(`${API_BASE}/api/admin/geofences/${id}`);
      fetchGeofences();
      fetchStats();
    } catch(e) { console.error("Error deleting geofence", e); }
  };

  const handleSaveGeofence = async () => {
    try {
      await axios.post(`${API_BASE}/api/admin/geofences`, editGeofence);
      setShowGeofenceModal(false);
      fetchGeofences();
    } catch (e) { console.error("Error saving geofence", e); }
  };

  const unreadCount = alerts.filter(a => !a.read && a.type === "alarm").length;

  const filteredEmployees = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        String(e.id).includes(searchQuery) ||
                        e.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "All" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const masterGeofence = geofences.find(g => g.name === "Master") || (geofences.length > 0 ? geofences[0] : { lat: 20.2961, lng: 85.8245, radius: 250 });

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="w-52 min-w-[13rem] bg-[#0f1623] flex flex-col py-6 px-3 gap-2 z-20 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-3 mb-6">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="leading-none">
            <p className="text-white font-black text-xs tracking-widest uppercase">Secure</p>
            <p className="text-blue-400 font-black text-xs tracking-widest uppercase">Track</p>
          </div>
          <span className="ml-1 text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Admin</span>
        </div>

        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveNav(key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 w-full text-left ${
              activeNav === key
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={17} className="flex-shrink-0"/>
            <span>{label}</span>
            {key === "alerts" && unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
            {key === "updaterequests" && updateRequests.filter(r => r.status === "Pending").length > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {updateRequests.filter(r => r.status === "Pending").length}
              </span>
            )}
            {key === "leaverequests" && leaveRequests.filter(r => r.status === "Pending").length > 0 && (
              <span className="ml-auto bg-teal-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {leaveRequests.filter(r => r.status === "Pending").length}
              </span>
            )}
          </button>
        ))}

        <div className="mt-auto px-3 py-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">System Health</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
            <span className="text-xs text-green-400 font-bold">All Systems Operational</span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">v2.4.1 — Secure</p>
        </div>
      </aside>

      {/* ── MAIN PANEL ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── TOP HEADER ── */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0 z-10">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex-1"/>
          <span className="text-[11px] font-mono text-gray-500 hidden lg:block">{clockStr}</span>

          <div className="relative" ref={bellRef}>
            <button
              onClick={() => { setShowBell(p => !p); setShowAdmin(false); }}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            >
              <Bell size={18}/>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
            {showBell && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                  <p className="font-bold text-sm text-gray-800">Notifications</p>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{unreadCount} unread</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {alerts.filter(a => a.type === "alarm").map(a => (
                    <div key={a.id} className="px-4 py-3 hover:bg-gray-50 flex gap-3 items-start">
                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-xs font-bold text-gray-800 break-words">{a.event} — {a.user}</p>
                        <p className="text-[11px] text-gray-500 break-words mt-0.5">{a.detail}</p>
                        {a.countdown > 0 && <p className="text-[10px] text-red-500 font-bold mt-1">{fmt(a.countdown)} remaining</p>}
                      </div>
                    </div>
                  ))}
                  {alerts.filter(a => a.type === "alarm").length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-gray-400">No active alarms</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={adminRef}>
            <button
              onClick={() => { setShowAdmin(p => !p); setShowBell(false); }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs">A</div>
              <span className="text-sm font-bold text-gray-800">Administrator</span>
              <ChevronDown size={13} className={`text-gray-500 transition-transform ${showAdmin ? "rotate-180" : ""}`}/>
            </button>
            {showAdmin && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <User size={14}/> Profile
                </button>
                <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Settings size={14}/> Settings
                </button>
                <div className="my-1 border-t border-gray-100"/>
                <button 
                  onClick={() => { localStorage.removeItem("user"); window.location.href = "/"; }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut size={14}/> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── SCROLLABLE CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4 relative">
          
          {/* DASHBOARD VIEW */}
          {activeNav === "dashboard" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard icon={Smartphone} iconBg="bg-blue-100" iconColor="text-blue-600" label="Active Devices" value={stats.activeDevices} />
                <StatCard icon={ShieldAlert} iconBg="bg-purple-100" iconColor="text-purple-600" label="Geofences Active" value={stats.totalGeofences} />
                <StatCard icon={Wifi} iconBg="bg-green-100" iconColor="text-green-600" label="Total Employees" value={stats.totalEmployees} />
                <StatCard icon={TrendingUp} iconBg="bg-orange-100" iconColor="text-orange-600" label="OTP Sent Today" value={stats.otpSentToday} pulse={stats.activeBreaches > 0} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col" style={{ minHeight: "360px" }}>
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Global Live Tracking</h2>
                    </div>
                  </div>
                  <div className="flex-1 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 relative" style={{ height: "280px" }}>
                    <MapContainer center={[masterGeofence.lat, masterGeofence.lng]} zoom={14} style={{ width: "100%", height: "100%" }} zoomControl={true}>
                      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {geofences.map(gf => (
                        <Circle key={gf._id} center={[gf.lat, gf.lng]} radius={gf.radius} pathOptions={{ fillColor: gf.color, color: gf.color, fillOpacity: 0.1, weight: 2 }}>
                          <Popup><b>{gf.name}</b><br/>Radius: {gf.radius}m</Popup>
                        </Circle>
                      ))}
                      {filteredEmployees.map(emp => (
                        <Marker key={emp.id} position={[emp.lat, emp.lng]} icon={emp.status === "Inside" ? safeIcon : emp.status === "Warning" ? warnIcon : alertIcon}>
                          <Popup>
                            <div className="text-xs font-sans min-w-[130px]">
                              <p className="font-bold text-gray-800">{emp.name}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${emp.status === "Inside" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {emp.status.toUpperCase()}
                              </span>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col" style={{ minHeight: "360px" }}>
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Recent Alerts</h2>
                    {stats.activeBreaches > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full animate-pulse">● LIVE</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {alerts.slice(0, 10).map(alert => (
                      <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} onResolve={resolveAlert} />
                    ))}
                    {alerts.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                        <CheckCircle size={28} className="text-green-400 mb-2"/>
                        <p className="text-sm font-bold">All Clear</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* EMPLOYEES VIEW */}
          {activeNav === "employees" && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Employee Directory</h2>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100">
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allEmployeesDB.map(emp => (
                      <tr key={emp._id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-bold text-gray-500">{emp.EmployeeId || "-"}</td>
                        <td className="py-3 px-4 font-bold text-gray-800 text-sm">{emp.name}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{emp.email}</td>
                        <td className="py-3 px-4"><span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">{emp.role}</span></td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => handleDeleteEmployee(emp._id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                            <Trash2 size={14}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {allEmployeesDB.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">No employees found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GEOFENCES VIEW */}
          {activeNav === "geofences" && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Geofence Zones</h2>
                <button onClick={() => { setEditGeofence({ name: "", lat: 20.2961, lng: 85.8245, radius: 100, color: "#3b82f6", description: "" }); setShowGeofenceModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">
                  <Plus size={14}/> New Zone
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {geofences.map(gf => (
                  <div key={gf._id} className="border border-gray-200 rounded-xl p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 flex gap-2">
                      <button onClick={() => handleDeleteGeofence(gf._id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: gf.color }}></span>
                      <h3 className="font-bold text-gray-800">{gf.name}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{gf.description || "No description"}</p>
                    <div className="text-xs font-mono text-gray-500 bg-gray-50 p-2 rounded-lg">
                      <p>Center: {gf.lat.toFixed(4)}, {gf.lng.toFixed(4)}</p>
                      <p>Radius: {gf.radius}m</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ALERTS VIEW */}
          {activeNav === "alerts" && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[500px]">
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-4">Alert History</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100">
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Detail</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {alerts.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-500">{new Date(a.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 font-bold">{a.user} <span className="text-[10px] font-normal text-gray-400 block">{a.empId}</span></td>
                        <td className="py-3 px-4 text-gray-700">{a.event}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${a.status === "Alarm" ? "bg-red-100 text-red-700" : a.status === "Resolved" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{a.detail}</td>
                        <td className="py-3 px-4 text-right">
                          {a.status === "Alarm" && (
                            <button onClick={() => resolveAlert(a.id)} className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded hover:bg-green-100">Resolve</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LIVE MAPS VIEW */}
          {activeNav === "livemaps" && (
            <div className="bg-white rounded-xl border border-gray-200 p-2 h-[calc(100vh-120px)] flex flex-col">
              <MapContainer center={[masterGeofence.lat, masterGeofence.lng]} zoom={15} style={{ width: "100%", height: "100%", borderRadius: '8px' }} zoomControl={true}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {geofences.map(gf => (
                  <Circle key={gf._id} center={[gf.lat, gf.lng]} radius={gf.radius} pathOptions={{ fillColor: gf.color, color: gf.color, fillOpacity: 0.1, weight: 2 }}>
                    <Popup><b>{gf.name}</b><br/>{gf.radius}m</Popup>
                  </Circle>
                ))}
                {employees.map(emp => (
                  <Marker key={emp.id} position={[emp.lat, emp.lng]} icon={emp.status === "Inside" ? safeIcon : alertIcon}>
                    <Popup><b>{emp.name}</b><br/>{emp.status}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          {/* UPDATE REQUESTS */}
          {activeNav === "updaterequests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Profile Update Requests</h2>
              </div>
              <div className="space-y-3">
                {updateRequests.filter(r => r.status === "Pending").map((req) => (
                  <div key={req._id} className="bg-white rounded-xl border p-4 shadow-sm border-amber-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-gray-800">{req.userName} <span className="text-xs font-normal text-gray-500">({req.userEmail})</span></p>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-700">Pending</span>
                        </div>
                        <div className="mt-2 bg-gray-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          {req.requestedData?.name && <div><span className="font-bold text-gray-500">Name →</span> <span className="text-gray-800">{req.requestedData.name}</span></div>}
                          {req.requestedData?.email && <div><span className="font-bold text-gray-500">Email →</span> <span className="text-gray-800">{req.requestedData.email}</span></div>}
                          {req.requestedData?.employeeId && <div><span className="font-bold text-gray-500">Emp ID →</span> <span className="text-gray-800">{req.requestedData.employeeId}</span></div>}
                          {req.requestedData?.role && <div><span className="font-bold text-gray-500">Role →</span> <span className="text-gray-800">{req.requestedData.role}</span></div>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button onClick={async () => { await axios.put(`${API_BASE}/api/admin/update-requests/${req._id}/approve`); fetchUpdateReqs(); }} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-lg uppercase">Approve</button>
                        <button onClick={async () => { await axios.put(`${API_BASE}/api/admin/update-requests/${req._id}/reject`); fetchUpdateReqs(); }} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-black rounded-lg uppercase">Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
                {updateRequests.filter(r => r.status === "Pending").length === 0 && <p className="text-gray-500 text-center py-10">No pending update requests.</p>}
              </div>
            </div>
          )}

          {/* LEAVE REQUESTS VIEW */}
          {activeNav === "leaverequests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Leave & Special Requests</h2>
              </div>
              <div className="space-y-3">
                {leaveRequests.map((req) => (
                  <div key={req._id} className={`bg-white rounded-xl border p-4 shadow-sm ${req.status === "Pending" ? "border-teal-200" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-gray-800">{req.userName} <span className="text-xs font-normal text-gray-500">({req.userEmail})</span></p>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            req.status === "Pending" ? "bg-amber-100 text-amber-700" :
                            req.status === "Approved" ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>{req.status}</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-700">
                          <p className="font-bold text-teal-700">{req.requestType}</p>
                          <p><span className="text-gray-500">Dates:</span> {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</p>
                          <p className="mt-1"><span className="text-gray-500 block italic leading-relaxed bg-gray-50 p-2 rounded">"{req.reason}"</span></p>
                        </div>
                      </div>
                      {req.status === "Pending" && (
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button onClick={async () => { await axios.put(`${API_BASE}/api/admin/leave-requests/${req._id}/approve`); fetchLeaveReqs(); }} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-lg uppercase">Approve</button>
                          <button onClick={async () => { await axios.put(`${API_BASE}/api/admin/leave-requests/${req._id}/reject`); fetchLeaveReqs(); }} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-black rounded-lg uppercase">Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {leaveRequests.length === 0 && <p className="text-gray-500 text-center py-10">No leave requests found.</p>}
              </div>
            </div>
          )}

          {/* SETTINGS VIEW */}
          {activeNav === "settings" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[500px]">
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">System Settings</h2>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Company Name</label>
                  <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" value="SecureTrack Inc." disabled />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Default Alert Timeout (mins)</label>
                  <input type="number" className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50" value="5" disabled />
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-bold text-blue-800 mb-1">System is fully operational</p>
                  <p className="text-xs text-blue-600">All services (Database, Auth, Tracking, Mail, Geofence) are running smoothly.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* GEOFENCE MODAL */}
      {showGeofenceModal && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowGeofenceModal(false)}></div>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 relative z-10 animate-in fade-in zoom-in duration-200">
            <button onClick={() => setShowGeofenceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={16}/></button>
            <h3 className="font-bold text-gray-800 mb-4">Add / Edit Geofence</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Zone Name</label>
                <input type="text" value={editGeofence.name} onChange={e => setEditGeofence({...editGeofence, name: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Latitude</label>
                  <input type="number" step="0.0001" value={editGeofence.lat} onChange={e => setEditGeofence({...editGeofence, lat: parseFloat(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Longitude</label>
                  <input type="number" step="0.0001" value={editGeofence.lng} onChange={e => setEditGeofence({...editGeofence, lng: parseFloat(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Radius (meters)</label>
                <input type="number" value={editGeofence.radius} onChange={e => setEditGeofence({...editGeofence, radius: parseInt(e.target.value)})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Color (Hex)</label>
                <input type="text" value={editGeofence.color} onChange={e => setEditGeofence({...editGeofence, color: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"/>
              </div>
              <button onClick={handleSaveGeofence} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2 rounded-lg mt-2">Save Geofence</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;