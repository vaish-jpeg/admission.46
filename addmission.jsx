import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, addDoc, collection } from 'firebase/firestore';

// --- GLOBAL VARIABLES INJECTION (Provided by the Canvas environment) ---
// These variables are required for Firebase initialization and authentication.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The main application component
const App = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    email: '',
    program: '',
    notes: '',
  });
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length === 0) {
        setStatus("Error: Firebase config not found. Cannot initialize database.");
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      
      setDb(firestore);
      setAuth(firebaseAuth);

      // Log in with the custom token or anonymously
      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          setStatus(`Authentication failed: ${error.message}`);
        }
      };

      // Listen for auth state changes to set the userId
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
          setStatus(`Ready to submit form. User ID: ${user.uid}`);
        } else {
          // Trigger sign in if not logged in
          signIn();
        }
      });

      // Cleanup listener on component unmount
      return () => unsubscribe();

    } catch (e) {
      console.error("Initialization failed:", e);
      setStatus(`Initialization error: ${e.message}`);
    }
  }, []);

  // Update form data state
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 2. Form Submission Handler (DBMS Write Operation)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!db || !userId) {
      setStatus("Error: Database not ready. Please wait for initialization.");
      return;
    }
    
    setIsLoading(true);
    setStatus("Submitting application...");

    // Path for private user data: /artifacts/{appId}/users/{userId}/admissions_forms
    const formCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'admissions_forms');
    
    // Data structure for the DBMS document
    const applicationData = {
        ...formData,
        submissionDate: new Date().toISOString(),
        status: 'Pending Review',
    };
    
    try {
        // addDoc handles the INSERT query into the Firestore collection
        const docRef = await addDoc(formCollectionRef, applicationData);
        setStatus(`✅ Application submitted successfully! Document ID: ${docRef.id}`);
        setFormData({
          firstName: '',
          lastName: '',
          dob: '',
          email: '',
          program: '',
          notes: '',
        }); // Clear form on success
    } catch (error) {
        console.error("Error writing document: ", error);
        setStatus(`❌ Submission failed: ${error.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-xl mx-auto bg-white shadow-2xl rounded-xl p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold text-blue-800 text-center mb-6">
          College Admission Application
        </h1>
        
        {/* Status and User ID Display */}
        <div className="mb-4 p-3 text-sm rounded-lg border border-gray-200">
            <p className="text-gray-700"><strong>Status:</strong> <span className={status.startsWith('Error') ? 'text-red-600 font-bold' : status.startsWith('✅') ? 'text-green-600 font-bold' : 'text-blue-500'}>{status}</span></p>
            {userId && <p className="text-gray-700 mt-1 break-all"><strong>Auth ID:</strong> {userId}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Personal Details */}
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">1. Personal Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  id="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mt-4">Date of Birth *</label>
              <input
                type="date"
                name="dob"
                id="dob"
                value={formData.dob}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Section: Contact & Program */}
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">2. Contact & Program</h2>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address *</label>
              <input
                type="email"
                name="email"
                id="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="program" className="block text-sm font-medium text-gray-700">Program of Study *</label>
              <select
                name="program"
                id="program"
                value={formData.program}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select a Program</option>
                <option value="Computer Science">B.Sc. Computer Science</option>
                <option value="Business Administration">B.A. Business Administration</option>
                <option value="Mechanical Engineering">B.Eng. Mechanical Engineering</option>
                <option value="Liberal Arts">B.A. Liberal Arts</option>
              </select>
            </div>
          </div>
          
          {/* Section: Additional Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">3. Additional Notes</h2>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Tell us why you want to join this college (Optional)</label>
            <textarea
              name="notes"
              id="notes"
              rows="3"
              value={formData.notes}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
            ></textarea>
          </div>

          {/* Submission Button */}
          <button
            type="submit"
            disabled={isLoading || !db || !userId}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition duration-200 
              ${isLoading || !db || !userId ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`
            }
          >
            {isLoading ? 'Submitting...' : 'Submit Admission Application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;