import React from 'react';
import LiveClock from '../common/LiveClock';

const Navbar = () => {
  return (
    <nav className="flex items-center justify-between bg-[#F8F9FA] px-6 py-4 border-b border-gray-200 w-full">
      
      {/* Left Section: Logo & Title */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          {/* Shield Logo Icon */}
          <div className="text-blue-700">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          {/* Brand Name */}
          <div className="flex flex-col leading-none">
            <span className="font-bold text-blue-900 tracking-wide text-sm uppercase">Secure</span>
            <span className="font-bold text-blue-900 tracking-wide text-sm uppercase">Guard</span>
          </div>
        </div>
        
        {/* Divider */}
        <div className="h-8 border-l-2 border-gray-300"></div>
        
        {/* Page Title */}
        <h1 className="text-xl font-bold text-gray-800">Employee Portal</h1>
      </div>

      {/* Right Section: Status, Profile & Login */}
      <div className="flex items-center space-x-6">
        
        {/* Moved Date/Time & Status Block */}
        <div className="flex flex-col items-end space-y-1">
          <LiveClock/>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-600 font-medium">System Status:</span>
            <span className="bg-green-200 text-green-800 font-bold px-2 py-0.5 rounded-sm">
              ACTIVE
            </span>
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-3 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">
          <div className="flex flex-col text-right">
            <span className="text-sm font-extrabold text-gray-900 uppercase leading-tight tracking-wide">Prabin</span>
            <span className="text-xs text-gray-600 font-medium leading-tight">Software Engineer</span>
          </div>
        </div>

        {/* Login Button */}
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-5 rounded-md transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
          Login
        </button>

      </div>

    </nav>
  );
};

export default Navbar;