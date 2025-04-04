// Global variables for stopwatch (local UI display only)
let stopwatchInterval;
let stopwatchRunning = false;
let elapsedTime = 0;
let localUpdateInterval;

// Global variable for counters
let counters = [];

// Initialize the Chart.js chart
let counterChart;

// DOM Elements
document.addEventListener('DOMContentLoaded', async function() {
  // Load data from IndexedDB
  await loadData();

  // Initialize UI elements
  initializeStopwatch();
  initializeCounters();
  initializeChartDisplay();
  
  // Set up event listeners
  document.getElementById('start-stop').addEventListener('click', toggleStopwatch);
  document.getElementById('reset').addEventListener('click', resetStopwatch);
  document.getElementById('add-counter').addEventListener('click', addCounter);
  document.getElementById('export-csv').addEventListener('click', exportToCSV);
  document.getElementById('save-session').addEventListener('click', saveSession);
  document.getElementById('view-history').addEventListener('click', viewSessionHistory);
  document.getElementById('chart-type').addEventListener('change', changeChartType);
  document.getElementById('compare-chart').addEventListener('click', showComparisonChart);
});

// Load saved data from background script and IndexedDB
async function loadData() {
  try {
    // Load stopwatch state from background script
    chrome.runtime.sendMessage({ action: 'getStopwatchState' }, function(response) {
      if (response) {
        console.log('Got stopwatch state from background:', response);
        elapsedTime = response.elapsedTime || 0;
        stopwatchRunning = response.running || false;
        
        // Update the UI
        updateStopwatchDisplay();
        
        // Set up local update interval to keep the UI in sync with background
        if (localUpdateInterval) {
          clearInterval(localUpdateInterval);
        }
        
        localUpdateInterval = setInterval(function() {
          // Get latest state from background
          chrome.runtime.sendMessage({ action: 'getStopwatchState' }, function(response) {
            if (response) {
              elapsedTime = response.elapsedTime || 0;
              stopwatchRunning = response.running || false;
              updateStopwatchDisplay();
              
              // Update button state
              const button = document.getElementById('start-stop');
              button.textContent = stopwatchRunning ? '⏸️ Pause' : '▶️ Start';
            }
          });
        }, 100); // Update 10 times per second
      }
    });
    
    // Load counters from IndexedDB
    const loadedCounters = await Database.Counters.loadCounters();
    if (loadedCounters && loadedCounters.length > 0) {
      counters = loadedCounters;
      renderCounters();
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Save data to IndexedDB
async function saveData() {
  try {
    const stopwatchData = {
      elapsedTime: elapsedTime,
      running: stopwatchRunning
    };
    
    // Save stopwatch state
    await Database.Stopwatch.saveState(stopwatchData);
    
    // Save counters
    await Database.Counters.saveCounters(counters);
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Save current session (stopwatch and counters state) to history
async function saveSession() {
  try {
    const session = {
      name: prompt('Enter a name for this session:', `Session ${new Date().toLocaleDateString()}`),
      timestamp: Date.now(),
      stopwatch: {
        elapsedTime: elapsedTime
      },
      counters: [...counters]
    };
    
    if (session.name) {
      const sessionId = await Database.Sessions.saveSession(session);
      if (sessionId) {
        alert('Session saved successfully!');
      }
    }
  } catch (error) {
    console.error('Error saving session:', error);
    alert('Failed to save session.');
  }
}

// View session history
async function viewSessionHistory() {
  try {
    const sessions = await Database.Sessions.loadSessions();
    
    if (sessions.length === 0) {
      alert('No session history found.');
      return;
    }
    
    // Create and show the session history modal
    const modal = document.createElement('div');
    modal.className = 'history-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'history-modal-content';
    
    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function() {
      document.body.removeChild(modal);
    };
    
    const heading = document.createElement('h2');
    heading.textContent = 'Session History';
    
    const sessionsList = document.createElement('div');
    sessionsList.className = 'sessions-list';
    
    sessions.forEach(session => {
      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-item';
      
      const sessionHeader = document.createElement('div');
      sessionHeader.className = 'session-header';
      
      const sessionName = document.createElement('h3');
      sessionName.textContent = session.name || 'Unnamed Session';
      
      const sessionDate = document.createElement('span');
      sessionDate.className = 'session-date';
      sessionDate.textContent = new Date(session.timestamp).toLocaleString();
      
      const loadBtn = document.createElement('button');
      loadBtn.className = 'session-btn load';
      loadBtn.textContent = 'Load';
      loadBtn.onclick = function() {
        if (confirm('Load this session? Current data will be overwritten.')) {
          loadSession(session);
          document.body.removeChild(modal);
        }
      };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'session-btn delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = async function() {
        if (confirm('Delete this session? This cannot be undone.')) {
          await Database.Sessions.deleteSession(session.id);
          sessionItem.remove();
          if (sessionsList.children.length === 0) {
            document.body.removeChild(modal);
          }
        }
      };
      
      sessionHeader.appendChild(sessionName);
      sessionHeader.appendChild(sessionDate);
      sessionHeader.appendChild(loadBtn);
      sessionHeader.appendChild(deleteBtn);
      
      const sessionDetails = document.createElement('div');
      sessionDetails.className = 'session-details';
      
      const timeDisplay = document.createElement('div');
      timeDisplay.className = 'session-time';
      const time = session.stopwatch.elapsedTime;
      const hours = Math.floor(time / (1000 * 60 * 60));
      const minutes = Math.floor((time % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((time % (1000 * 60)) / 1000);
      timeDisplay.textContent = `Time: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      const countersDisplay = document.createElement('div');
      countersDisplay.className = 'session-counters';
      countersDisplay.textContent = `Counters: ${session.counters.length}`;
      
      sessionDetails.appendChild(timeDisplay);
      sessionDetails.appendChild(countersDisplay);
      
      sessionItem.appendChild(sessionHeader);
      sessionItem.appendChild(sessionDetails);
      
      sessionsList.appendChild(sessionItem);
    });
    
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(heading);
    modalContent.appendChild(sessionsList);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading session history:', error);
    alert('Failed to load session history.');
  }
}

// Load a specific session
async function loadSession(session) {
  try {
    // First, stop the stopwatch in the background
    chrome.runtime.sendMessage({ action: 'stopStopwatch' }, async function(response) {
      if (response && response.success) {
        // After stopped, reset it
        chrome.runtime.sendMessage({ action: 'resetStopwatch' }, async function(response) {
          if (response && response.success) {
            // Update the stopwatch with the session time
            elapsedTime = session.stopwatch.elapsedTime;
            
            // Update stopwatch state in the database and UI
            const stopwatchData = {
              elapsedTime: elapsedTime,
              running: false,
              startTime: null
            };
            
            // Save to database
            await Database.Stopwatch.saveState(stopwatchData);
            
            // Update UI
            updateStopwatchDisplay();
            document.getElementById('start-stop').textContent = '▶️ Start';
            
            // Update counters
            counters = [...session.counters];
            renderCounters();
            
            // Save counter state
            await Database.Counters.saveCounters(counters);
            
            // Update chart
            updateChart();
          }
        });
      }
    });
  } catch (error) {
    console.error('Error loading session:', error);
    alert('Failed to load session.');
  }
}

// Stopwatch functions
function initializeStopwatch() {
  // Initialize background indicator status
  const indicator = document.getElementById('background-indicator');
  if (indicator) {
    indicator.className = 'background-indicator ' + (stopwatchRunning ? 'running' : 'stopped');
  }
  
  // Update display
  updateStopwatchDisplay();
}

function toggleStopwatch() {
  const button = document.getElementById('start-stop');
  
  if (stopwatchRunning) {
    stopStopwatch();
    button.textContent = '▶️ Start';
  } else {
    startStopwatch();
    button.textContent = '⏸️ Pause';
  }
}

function startStopwatch() {
  if (!stopwatchRunning) {
    // Send message to background script to start stopwatch
    chrome.runtime.sendMessage({ action: 'startStopwatch' }, function(response) {
      if (response && response.success) {
        console.log('Stopwatch started in background');
        stopwatchRunning = true;
        
        // Update UI immediately
        document.getElementById('start-stop').textContent = '⏸️ Pause';
      }
    });
  }
}

function stopStopwatch() {
  if (stopwatchRunning) {
    // Send message to background script to stop stopwatch
    chrome.runtime.sendMessage({ action: 'stopStopwatch' }, function(response) {
      if (response && response.success) {
        console.log('Stopwatch stopped in background');
        stopwatchRunning = false;
        
        // Update UI immediately
        document.getElementById('start-stop').textContent = '▶️ Start';
      }
    });
  }
}

function resetStopwatch() {
  // Send message to background script to reset stopwatch
  chrome.runtime.sendMessage({ action: 'resetStopwatch' }, function(response) {
    if (response && response.success) {
      console.log('Stopwatch reset in background');
      stopwatchRunning = false;
      elapsedTime = 0;
      
      // Update UI immediately
      updateStopwatchDisplay();
      document.getElementById('start-stop').textContent = '▶️ Start';
    }
  });
}

function updateStopwatchDisplay() {
  // Calculate hours, minutes, seconds, and milliseconds
  const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
  const milliseconds = Math.floor((elapsedTime % 1000) / 10);

  // Format the time values with leading zeros
  const hoursFormatted = hours.toString().padStart(2, '0');
  const minutesFormatted = minutes.toString().padStart(2, '0');
  const secondsFormatted = seconds.toString().padStart(2, '0');
  const millisecondsFormatted = milliseconds.toString().padStart(2, '0');
  
  // Update the display with animation for changing digits
  updateTimeElement('hours', hoursFormatted);
  updateTimeElement('minutes', minutesFormatted);
  updateTimeElement('seconds', secondsFormatted);
  updateTimeElement('milliseconds', millisecondsFormatted);
  
  // Update background indicator
  const indicator = document.getElementById('background-indicator');
  if (indicator) {
    if (stopwatchRunning) {
      indicator.className = 'background-indicator running';
    } else {
      indicator.className = 'background-indicator stopped';
    }
  }
}

function updateTimeElement(id, newValue) {
  const element = document.getElementById(id);
  
  // Only apply animation if the value is changing
  if (element.textContent !== newValue) {
    // Add a subtle animation
    element.style.transform = 'translateY(-2px)';
    element.style.opacity = '0.8';
    
    // Update the text
    element.textContent = newValue;
    
    // Return to normal after a short delay
    setTimeout(() => {
      element.style.transition = 'all 0.1s ease-out';
      element.style.transform = 'translateY(0)';
      element.style.opacity = '1';
    }, 50);
  } else {
    // Just update the text without animation if it's the same
    element.textContent = newValue;
  }
}

// Counter functions
function initializeCounters() {
  renderCounters();
}

function renderCounters() {
  const countersContainer = document.getElementById('counters-container');
  countersContainer.innerHTML = '';
  
  if (counters.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No counters yet. Add one below.';
    countersContainer.appendChild(emptyMessage);
    return;
  }
  
  counters.forEach((counter, index) => {
    // Create counter with animation
    const counterItem = document.createElement('div');
    counterItem.className = 'counter-item';
    counterItem.style.opacity = '0';
    counterItem.style.transform = 'translateY(10px)';
    
    // Counter name with tooltip for long names
    const counterName = document.createElement('div');
    counterName.className = 'counter-name';
    counterName.textContent = counter.name;
    counterName.title = counter.name; // Shows full name on hover
    
    const counterControls = document.createElement('div');
    counterControls.className = 'counter-controls';
    
    // Decrement button
    const decrementBtn = document.createElement('button');
    decrementBtn.className = 'counter-btn decrement';
    decrementBtn.textContent = '−';
    decrementBtn.title = 'Decrease counter';
    decrementBtn.addEventListener('click', () => decrementCounter(index));
    
    // Counter value display
    const counterValue = document.createElement('div');
    counterValue.className = 'counter-value';
    counterValue.textContent = counter.value;
    
    // Increment button
    const incrementBtn = document.createElement('button');
    incrementBtn.className = 'counter-btn increment';
    incrementBtn.textContent = '+';
    incrementBtn.title = 'Increase counter';
    incrementBtn.addEventListener('click', () => incrementCounter(index));
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'counter-btn delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete counter';
    deleteBtn.addEventListener('click', () => deleteCounter(index));
    
    // Add all elements to their containers
    counterControls.appendChild(decrementBtn);
    counterControls.appendChild(counterValue);
    counterControls.appendChild(incrementBtn);
    counterControls.appendChild(deleteBtn);
    
    counterItem.appendChild(counterName);
    counterItem.appendChild(counterControls);
    
    countersContainer.appendChild(counterItem);
    
    // Animate appearance of the counter
    setTimeout(() => {
      counterItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      counterItem.style.opacity = '1';
      counterItem.style.transform = 'translateY(0)';
    }, index * 50); // Staggered animation
  });
  
  updateChart();
}

function addCounter() {
  const counterNameInput = document.getElementById('counter-name');
  const counterName = counterNameInput.value.trim();
  
  if (counterName) {
    counters.push({
      name: counterName,
      value: 0,
      timestamp: Date.now()
    });
    
    counterNameInput.value = '';
    renderCounters();
    saveData();
  }
}

function incrementCounter(index) {
  counters[index].value++;
  counters[index].timestamp = Date.now();
  renderCounters();
  saveData();
}

function decrementCounter(index) {
  if (counters[index].value > 0) {
    counters[index].value--;
    counters[index].timestamp = Date.now();
    renderCounters();
    saveData();
  }
}

function deleteCounter(index) {
  counters.splice(index, 1);
  renderCounters();
  saveData();
}

// Chart functionality
function initializeChartDisplay() {
  const ctx = document.getElementById('counter-chart').getContext('2d');
  
  // Use theme colors (from the CSS variables)
  const style = getComputedStyle(document.documentElement);
  const primaryColor = style.getPropertyValue('--primary-color') || '#4361ee';
  const secondaryColor = style.getPropertyValue('--secondary-color') || '#3f37c9';
  const successColor = style.getPropertyValue('--success-color') || '#4bc0c0';
  const dangerColor = style.getPropertyValue('--danger-color') || '#ef476f';
  
  // Create gradient for bar charts
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(67, 97, 238, 0.8)');
  gradient.addColorStop(1, 'rgba(67, 97, 238, 0.2)');
  
  counterChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Counter Values',
        data: [],
        backgroundColor: gradient,
        borderColor: primaryColor,
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(67, 97, 238, 0.9)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            precision: 0,
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
            }
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 14
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: {
            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            size: 14
          },
          bodyFont: {
            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            size: 13
          },
          padding: 12,
          cornerRadius: 6,
          displayColors: false
        }
      }
    }
  });
  
  updateChart();
}

function updateChart() {
  const labels = counters.map(counter => counter.name);
  const data = counters.map(counter => counter.value);
  
  counterChart.data.labels = labels;
  counterChart.data.datasets[0].data = data;
  counterChart.update();
}

// Update chart type based on user selection
function changeChartType() {
  const chartType = document.getElementById('chart-type').value;
  counterChart.config.type = chartType;
  counterChart.update();
}

// Show a comparison chart that relates counter values to time
function showComparisonChart() {
  if (counters.length === 0) {
    // Create a styled alert instead of browser alert
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'history-modal';
    alertOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    
    const alertBox = document.createElement('div');
    alertBox.className = 'history-modal-content';
    alertBox.style.maxWidth = '300px';
    alertBox.style.textAlign = 'center';
    alertBox.style.padding = '25px';
    
    const alertIcon = document.createElement('div');
    alertIcon.innerHTML = '&#9888;'; // Warning symbol
    alertIcon.style.fontSize = '48px';
    alertIcon.style.marginBottom = '15px';
    alertIcon.style.color = 'var(--danger-color)';
    
    const alertMessage = document.createElement('p');
    alertMessage.textContent = 'No counters to compare. Add some counters first.';
    alertMessage.style.marginBottom = '20px';
    
    const alertButton = document.createElement('button');
    alertButton.textContent = 'OK';
    alertButton.className = 'control-btn';
    alertButton.style.margin = '0 auto';
    alertButton.style.minWidth = '100px';
    alertButton.onclick = function() {
      document.body.removeChild(alertOverlay);
    };
    
    alertBox.appendChild(alertIcon);
    alertBox.appendChild(alertMessage);
    alertBox.appendChild(alertButton);
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);
    
    // Add animation
    setTimeout(() => {
      alertBox.style.transition = 'all 0.3s ease';
      alertBox.style.transform = 'scale(1)';
      alertBox.style.opacity = '1';
    }, 10);
    
    return;
  }
  
  // Create modal for comparison chart with enhanced styling
  const modal = document.createElement('div');
  modal.className = 'history-modal';
  
  // Add fade-in animation
  modal.style.opacity = '0';
  modal.style.transition = 'opacity 0.3s ease';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'history-modal-content';
  modalContent.style.width = '90%';
  modalContent.style.transform = 'scale(0.95)';
  modalContent.style.opacity = '0';
  modalContent.style.transition = 'all 0.3s ease';
  
  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = function() {
    // Add close animation
    modalContent.style.transform = 'scale(0.95)';
    modalContent.style.opacity = '0';
    modal.style.opacity = '0';
    
    setTimeout(() => {
      document.body.removeChild(modal);
    }, 300);
  };
  
  const heading = document.createElement('h2');
  heading.textContent = 'Time vs Counter Comparison';
  heading.style.color = 'var(--primary-color)';
  heading.style.textAlign = 'center';
  heading.style.marginBottom = '20px';
  
  // Create canvas for the comparison chart with enhanced styling
  const chartContainer = document.createElement('div');
  chartContainer.style.height = '400px';
  chartContainer.style.width = '100%';
  chartContainer.style.padding = '15px';
  chartContainer.style.backgroundColor = 'var(--light-bg)';
  chartContainer.style.borderRadius = 'var(--border-radius)';
  
  const canvas = document.createElement('canvas');
  canvas.id = 'comparison-chart';
  
  chartContainer.appendChild(canvas);
  
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(heading);
  modalContent.appendChild(chartContainer);
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Trigger animations after DOM update
  setTimeout(() => {
    modal.style.opacity = '1';
    modalContent.style.transform = 'scale(1)';
    modalContent.style.opacity = '1';
  }, 10);
  
  // Create time-based datasets
  const ctx = document.getElementById('comparison-chart').getContext('2d');
  
  // Get formatted time for x-axis
  const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Create a time-based dataset for each counter
  const datasets = counters.map((counter, index) => {
    // Generate a distinct color based on index
    const hue = (index * 137) % 360; // Golden angle approximation for color distribution
    const color = `hsl(${hue}, 70%, 60%)`;
    
    return {
      label: counter.name,
      data: [{
        x: formattedTime,
        y: counter.value
      }],
      backgroundColor: color,
      borderColor: color,
      borderWidth: 2,
      fill: false
    };
  });
  
  // If there are saved sessions, add their data points
  Database.Sessions.loadSessions().then(sessions => {
    // Update datasets with session data
    sessions.forEach(session => {
      // Get formatted time for this session
      const sessionHours = Math.floor(session.stopwatch.elapsedTime / (1000 * 60 * 60));
      const sessionMinutes = Math.floor((session.stopwatch.elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
      const sessionSeconds = Math.floor((session.stopwatch.elapsedTime % (1000 * 60)) / 1000);
      const sessionTime = `${sessionHours.toString().padStart(2, '0')}:${sessionMinutes.toString().padStart(2, '0')}:${sessionSeconds.toString().padStart(2, '0')}`;
      
      // Add data points for matching counters
      session.counters.forEach(sessionCounter => {
        const datasetIndex = datasets.findIndex(ds => ds.label === sessionCounter.name);
        if (datasetIndex !== -1) {
          datasets[datasetIndex].data.push({
            x: sessionTime,
            y: sessionCounter.value
          });
        }
      });
    });
    
    // Create the comparison chart
    new Chart(ctx, {
      type: 'line',
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Elapsed Time'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Counter Value'
            },
            ticks: {
              precision: 0
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Counter Values vs. Time',
            font: {
              size: 16
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y}`;
              }
            }
          }
        }
      }
    });
  }).catch(error => {
    console.error('Error loading sessions for comparison chart:', error);
    
    // Create a basic chart even if session loading fails
    new Chart(ctx, {
      type: 'line',
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Elapsed Time'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Counter Value'
            },
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  });
}

// CSV Export function with enhanced UI
function exportToCSV() {
  if (counters.length === 0) {
    // Use the same styled alert as in showComparisonChart
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'history-modal';
    alertOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    
    const alertBox = document.createElement('div');
    alertBox.className = 'history-modal-content';
    alertBox.style.maxWidth = '300px';
    alertBox.style.textAlign = 'center';
    alertBox.style.padding = '25px';
    alertBox.style.transform = 'scale(0.95)';
    alertBox.style.opacity = '0';
    
    const alertIcon = document.createElement('div');
    alertIcon.innerHTML = '&#9888;'; // Warning symbol
    alertIcon.style.fontSize = '48px';
    alertIcon.style.marginBottom = '15px';
    alertIcon.style.color = 'var(--danger-color)';
    
    const alertMessage = document.createElement('p');
    alertMessage.textContent = 'No data to export. Add some counters first.';
    alertMessage.style.marginBottom = '20px';
    
    const alertButton = document.createElement('button');
    alertButton.textContent = 'OK';
    alertButton.className = 'control-btn';
    alertButton.style.margin = '0 auto';
    alertButton.style.minWidth = '100px';
    alertButton.onclick = function() {
      alertBox.style.transform = 'scale(0.95)';
      alertBox.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(alertOverlay);
      }, 300);
    };
    
    alertBox.appendChild(alertIcon);
    alertBox.appendChild(alertMessage);
    alertBox.appendChild(alertButton);
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);
    
    // Add animation
    setTimeout(() => {
      alertBox.style.transition = 'all 0.3s ease';
      alertBox.style.transform = 'scale(1)';
      alertBox.style.opacity = '1';
    }, 10);
    
    return;
  }
  
  // Format stopwatch time for export
  const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Create CSV content
  let csvContent = 'Name,Value,Timestamp,Elapsed Time\n';
  
  counters.forEach(counter => {
    const timestamp = new Date(counter.timestamp).toLocaleString();
    csvContent += `"${counter.name}",${counter.value},"${timestamp}","${formattedTime}"\n`;
  });
  
  // Show export progress modal
  const exportModal = document.createElement('div');
  exportModal.className = 'history-modal';
  exportModal.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  
  const exportBox = document.createElement('div');
  exportBox.className = 'history-modal-content';
  exportBox.style.maxWidth = '300px';
  exportBox.style.textAlign = 'center';
  exportBox.style.padding = '25px';
  exportBox.style.transform = 'scale(0.95)';
  exportBox.style.opacity = '0';
  
  const exportIcon = document.createElement('div');
  exportIcon.innerHTML = '📊'; // Export icon
  exportIcon.style.fontSize = '48px';
  exportIcon.style.marginBottom = '15px';
  exportIcon.style.color = 'var(--success-color)';
  
  const exportMessage = document.createElement('p');
  exportMessage.textContent = 'Preparing CSV export...';
  exportMessage.style.marginBottom = '20px';
  
  const progressBar = document.createElement('div');
  progressBar.style.width = '100%';
  progressBar.style.height = '6px';
  progressBar.style.backgroundColor = '#e9ecef';
  progressBar.style.borderRadius = '3px';
  progressBar.style.marginBottom = '20px';
  progressBar.style.overflow = 'hidden';
  
  const progressFill = document.createElement('div');
  progressFill.style.width = '0%';
  progressFill.style.height = '100%';
  progressFill.style.backgroundColor = 'var(--success-color)';
  progressFill.style.transition = 'width 0.5s ease';
  
  progressBar.appendChild(progressFill);
  
  exportBox.appendChild(exportIcon);
  exportBox.appendChild(exportMessage);
  exportBox.appendChild(progressBar);
  
  exportModal.appendChild(exportBox);
  document.body.appendChild(exportModal);
  
  // Animate modal appearance
  setTimeout(() => {
    exportBox.style.transition = 'all 0.3s ease';
    exportBox.style.transform = 'scale(1)';
    exportBox.style.opacity = '1';
    
    // Animate progress bar
    setTimeout(() => {
      progressFill.style.width = '40%';
      
      setTimeout(() => {
        progressFill.style.width = '80%';
        
        // Create and download the CSV file
        setTimeout(() => {
          progressFill.style.width = '100%';
          exportMessage.textContent = 'Export complete!';
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
          const date = new Date().toISOString().split('T')[0];
          const filename = `stopwatch-counters-${date}.csv`;
          saveAs(blob, filename);
          
          // Show success message and close modal
          setTimeout(() => {
            exportBox.style.transform = 'scale(0.95)';
            exportBox.style.opacity = '0';
            setTimeout(() => {
              document.body.removeChild(exportModal);
            }, 300);
          }, 1000);
        }, 300);
      }, 300);
    }, 300);
  }, 10);
}
