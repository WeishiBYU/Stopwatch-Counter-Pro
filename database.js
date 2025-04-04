// Database handling for the Stopwatch with Counters Chrome extension
// Using IndexedDB for data persistence

const DB_NAME = 'StopwatchCountersDB';
const DB_VERSION = 1;
const STOPWATCH_STORE = 'stopwatch';
const COUNTERS_STORE = 'counters';
const SESSIONS_STORE = 'sessions';

// Open database connection
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STOPWATCH_STORE)) {
        db.createObjectStore(STOPWATCH_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(COUNTERS_STORE)) {
        db.createObjectStore(COUNTERS_STORE, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id', autoIncrement: true });
        sessionsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Stopwatch operations
const StopwatchDB = {
  // Save stopwatch state
  saveState: async (stopwatchData) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STOPWATCH_STORE], 'readwrite');
      const store = transaction.objectStore(STOPWATCH_STORE);
      
      // Always use the same ID for the stopwatch state
      stopwatchData.id = 'current';
      
      // Add or update the stopwatch state
      store.put(stopwatchData);
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error saving stopwatch state:', error);
      return false;
    }
  },

  // Load stopwatch state
  loadState: async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STOPWATCH_STORE], 'readonly');
      const store = transaction.objectStore(STOPWATCH_STORE);
      
      const request = store.get('current');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error loading stopwatch state:', error);
      return null;
    }
  }
};

// Counters operations
const CountersDB = {
  // Save a counter
  saveCounter: async (counter) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([COUNTERS_STORE], 'readwrite');
      const store = transaction.objectStore(COUNTERS_STORE);
      
      // Add or update the counter
      const request = counter.id ? store.put(counter) : store.add(counter);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error saving counter:', error);
      return null;
    }
  },

  // Save multiple counters
  saveCounters: async (counters) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([COUNTERS_STORE], 'readwrite');
      const store = transaction.objectStore(COUNTERS_STORE);
      
      // Clear existing counters
      store.clear();
      
      // Add all counters
      counters.forEach(counter => {
        store.add(counter);
      });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error saving counters:', error);
      return false;
    }
  },

  // Load all counters
  loadCounters: async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([COUNTERS_STORE], 'readonly');
      const store = transaction.objectStore(COUNTERS_STORE);
      
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error loading counters:', error);
      return [];
    }
  },

  // Delete a counter
  deleteCounter: async (counterId) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([COUNTERS_STORE], 'readwrite');
      const store = transaction.objectStore(COUNTERS_STORE);
      
      store.delete(counterId);
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error deleting counter:', error);
      return false;
    }
  }
};

// Session operations (for historical data)
const SessionsDB = {
  // Save a session (complete stopwatch and counter state at a point in time)
  saveSession: async (sessionData) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);
      
      // Add timestamp if not present
      if (!sessionData.timestamp) {
        sessionData.timestamp = Date.now();
      }
      
      const request = store.add(sessionData);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error saving session:', error);
      return null;
    }
  },

  // Load all sessions
  loadSessions: async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([SESSIONS_STORE], 'readonly');
      const store = transaction.objectStore(SESSIONS_STORE);
      const index = store.index('timestamp');
      
      const request = index.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error loading sessions:', error);
      return [];
    }
  },

  // Get a specific session
  getSession: async (sessionId) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([SESSIONS_STORE], 'readonly');
      const store = transaction.objectStore(SESSIONS_STORE);
      
      const request = store.get(sessionId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Delete a session
  deleteSession: async (sessionId) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(SESSIONS_STORE);
      
      store.delete(sessionId);
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }
};

// Export the database operations
const Database = {
  Stopwatch: StopwatchDB,
  Counters: CountersDB,
  Sessions: SessionsDB
};