// ==========================================
// FIREBASE & HUBTEL CONFIGURATION CREDENTIALS
// ==========================================

// Paste your Firebase SDK Web App configuration here:
const firebaseConfig = {
  apiKey: "AIzaSyBFC7vJvuGjHm5kDgTaNP-Z9892o2pkAmg",
  authDomain: "fja-sms.firebaseapp.com",
  projectId: "fja-sms",
  storageBucket: "fja-sms.firebasestorage.app",
  messagingSenderId: "1018520683632",
  appId: "1:1018520683632:web:c7c9464aee7798333fa0b5"
};

// Hubtel configuration (backend functions securely manage authentication and API secrets)
const hubtelConfig = {
  clientId: "cvnhobyo",
  clientSecret: "rnrxvuxd",
  senderId: "FathersJoy",
  backendFunction: "sendSchoolSMS",
  apiEndpoint: "https://us-central1-fja-sms.cloudfunctions.net/apiSendSMS",
  directEndpoint: "https://sms.hubtel.com/v1/messages/send"
};

// Helper flag to check if Firebase is configured
const isFirebaseConfigured = () => {
  return firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};

// Helper flag to check if Hubtel is configured
const isHubtelConfigured = () => {
  return true; // Configured via backend Cloud Function
};

// Export to window scope
window.firebaseConfig = firebaseConfig;
window.hubtelConfig = hubtelConfig;
window.isFirebaseConfigured = isFirebaseConfigured;
window.isHubtelConfigured = isHubtelConfigured;
