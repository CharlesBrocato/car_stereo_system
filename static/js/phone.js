/**
 * Phone Screen - Bluetooth HFP Integration
 * Handles call state, caller ID, and call control
 */

// State
let isConnected = false;
let currentCall = null;
let callStartTime = null;
let callTimerInterval = null;
let evtSource = null;
let dialBuffer = '';

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const deviceName = document.getElementById('deviceName');
const callBox = document.getElementById('callBox');
const callerIcon = document.getElementById('callerIcon');
const callerName = document.getElementById('callerName');
const callerNumber = document.getElementById('callerNumber');
const callState = document.getElementById('callState');
const callDuration = document.getElementById('callDuration');
const callActions = document.getElementById('callActions');
const answerBtn = document.getElementById('answerBtn');
const hangupBtn = document.getElementById('hangupBtn');
const dialpad = document.getElementById('dialpad');
const dialInput = document.getElementById('dialInput');
const noConnection = document.getElementById('noConnection');
const recentCalls = document.getElementById('recentCalls');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initEventSource();
    loadRecentCalls();
    
    // Initial status check
    checkPhoneStatus();
    
    // Periodic status check as backup
    setInterval(checkPhoneStatus, 5000);
});

/**
 * Initialize Server-Sent Events for real-time updates
 */
function initEventSource() {
    // Close existing connection if any
    if (evtSource) {
        evtSource.close();
    }
    
    evtSource = new EventSource('/api/phone/events');
    
    evtSource.onmessage = function(e) {
        try {
            const data = JSON.parse(e.data);
            handlePhoneUpdate(data);
        } catch (err) {
            console.error('Error parsing phone event:', err);
        }
    };
    
    evtSource.onerror = function(e) {
        console.log('EventSource error, will reconnect...');
        // Browser will automatically reconnect
    };
    
    evtSource.onopen = function() {
        console.log('EventSource connected');
    };
}

/**
 * Check phone connection status via API
 */
async function checkPhoneStatus() {
    try {
        const response = await fetch('/api/phone/status');
        const data = await response.json();
        handlePhoneUpdate(data);
    } catch (err) {
        console.error('Error checking phone status:', err);
        updateConnectionUI(false);
    }
}

/**
 * Handle phone status/event update
 */
function handlePhoneUpdate(data) {
    // Update connection status
    isConnected = data.connected || false;
    updateConnectionUI(isConnected, data.device_name);
    
    // Update call state
    if (data.call_state && data.call_state !== 'idle') {
        showActiveCall(data);
    } else {
        hideActiveCall();
    }
    
    // Update recent calls if provided
    if (data.recent_calls) {
        updateRecentCalls(data.recent_calls);
    }
}

/**
 * Update connection status UI
 */
function updateConnectionUI(connected, device = null) {
    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
        deviceName.textContent = device || 'Unknown Device';
        noConnection.classList.add('hidden');
        dialpad.classList.remove('hidden');
        recentCalls.classList.remove('hidden');
    } else {
        statusDot.classList.remove('connected', 'ringing', 'active');
        statusText.textContent = 'Not Connected';
        deviceName.textContent = 'No phone paired';
        noConnection.classList.remove('hidden');
        dialpad.classList.add('hidden');
        recentCalls.classList.add('hidden');
    }
}

/**
 * Show active call UI
 */
function showActiveCall(data) {
    currentCall = data;
    
    callBox.classList.remove('hidden', 'incoming', 'active');
    dialpad.classList.add('hidden');
    
    // Set caller info
    callerName.textContent = data.caller_name || 'Unknown Caller';
    callerNumber.textContent = data.caller_id || data.number || '';
    
    // Update based on call state
    switch (data.call_state) {
        case 'incoming':
        case 'ringing':
            callBox.classList.add('incoming');
            statusDot.classList.add('ringing');
            statusDot.classList.remove('active');
            callState.textContent = 'Incoming Call';
            callerIcon.textContent = '📲';
            answerBtn.classList.remove('hidden');
            hangupBtn.classList.remove('hidden');
            callDuration.classList.add('hidden');
            playRingtone();
            break;
            
        case 'active':
        case 'talking':
            callBox.classList.add('active');
            statusDot.classList.add('active');
            statusDot.classList.remove('ringing');
            callState.textContent = 'On Call';
            callerIcon.textContent = '📞';
            answerBtn.classList.add('hidden');
            hangupBtn.classList.remove('hidden');
            callDuration.classList.remove('hidden');
            stopRingtone();
            startCallTimer();
            break;
            
        case 'outgoing':
        case 'dialing':
            callBox.classList.add('active');
            statusDot.classList.add('active');
            callState.textContent = 'Calling...';
            callerIcon.textContent = '📱';
            answerBtn.classList.add('hidden');
            hangupBtn.classList.remove('hidden');
            callDuration.classList.add('hidden');
            break;
            
        case 'held':
            callState.textContent = 'On Hold';
            callerIcon.textContent = '⏸️';
            break;
            
        default:
            callState.textContent = data.call_state;
    }
}

/**
 * Hide active call UI
 */
function hideActiveCall() {
    currentCall = null;
    callBox.classList.add('hidden');
    callBox.classList.remove('incoming', 'active');
    dialpad.classList.remove('hidden');
    statusDot.classList.remove('ringing', 'active');
    stopCallTimer();
    stopRingtone();
}

/**
 * Start call duration timer
 */
function startCallTimer() {
    if (callTimerInterval) return;
    
    callStartTime = callStartTime || Date.now();
    
    callTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        callDuration.textContent = `${mins}:${secs}`;
    }, 1000);
}

/**
 * Stop call duration timer
 */
function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
    callDuration.textContent = '00:00';
}

/**
 * Answer incoming call
 */
async function answerCall() {
    try {
        const response = await fetch('/api/phone/answer', { method: 'POST' });
        const data = await response.json();
        
        if (data.success || data.ok) {
            console.log('Call answered');
        } else {
            console.error('Failed to answer call:', data.message);
        }
    } catch (err) {
        console.error('Error answering call:', err);
    }
}

/**
 * Hang up current call
 */
async function hangupCall() {
    try {
        const response = await fetch('/api/phone/hangup', { method: 'POST' });
        const data = await response.json();
        
        if (data.success || data.ok) {
            console.log('Call ended');
            hideActiveCall();
        } else {
            console.error('Failed to hang up:', data.message);
        }
    } catch (err) {
        console.error('Error hanging up:', err);
    }
}

/**
 * Make outgoing call
 */
async function makeCall() {
    const number = dialInput.value.trim();
    if (!number) return;
    
    try {
        const response = await fetch('/api/phone/dial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: number })
        });
        const data = await response.json();
        
        if (data.success || data.ok) {
            console.log('Dialing:', number);
            clearDial();
        } else {
            console.error('Failed to dial:', data.message);
            alert('Failed to dial: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error dialing:', err);
    }
}

/**
 * Dialpad key press
 */
function dialKey(key) {
    dialBuffer += key;
    dialInput.value = dialBuffer;
    
    // Play DTMF tone (visual feedback for now)
    dialInput.style.background = 'rgba(255, 255, 255, 0.1)';
    setTimeout(() => {
        dialInput.style.background = 'rgba(0, 0, 0, 0.3)';
    }, 100);
    
    // Send DTMF if in active call
    if (currentCall && (currentCall.call_state === 'active' || currentCall.call_state === 'talking')) {
        sendDTMF(key);
    }
}

/**
 * Clear dial input
 */
function clearDial() {
    if (dialBuffer.length > 0) {
        dialBuffer = dialBuffer.slice(0, -1);
        dialInput.value = dialBuffer;
    }
}

/**
 * Dial a specific number (from recent calls)
 */
function dialNumber(number) {
    dialBuffer = number;
    dialInput.value = number;
}

/**
 * Send DTMF tone during active call
 */
async function sendDTMF(digit) {
    try {
        await fetch('/api/phone/dtmf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ digit: digit })
        });
    } catch (err) {
        console.error('Error sending DTMF:', err);
    }
}

/**
 * Load recent calls from server
 */
async function loadRecentCalls() {
    try {
        const response = await fetch('/api/phone/recent');
        const data = await response.json();
        
        if (data.ok && data.calls) {
            updateRecentCalls(data.calls);
        }
    } catch (err) {
        console.error('Error loading recent calls:', err);
    }
}

/**
 * Update recent calls list UI
 */
function updateRecentCalls(calls) {
    const callList = document.getElementById('callList');
    
    if (!calls || calls.length === 0) {
        callList.innerHTML = `
            <li class="call-item">
                <span class="call-item-icon">📋</span>
                <div class="call-item-info">
                    <div class="call-item-name">No recent calls</div>
                    <div class="call-item-time">Your call history will appear here</div>
                </div>
            </li>
        `;
        return;
    }
    
    callList.innerHTML = calls.map(call => {
        const icon = call.type === 'missed' ? '📵' : 
                     call.type === 'outgoing' ? '📤' : '📥';
        const typeClass = call.type || 'incoming';
        const typeName = call.type === 'missed' ? 'Missed' :
                        call.type === 'outgoing' ? 'Outgoing' : 'Incoming';
        
        return `
            <li class="call-item" onclick="dialNumber('${call.number || ''}')">
                <span class="call-item-icon">${icon}</span>
                <div class="call-item-info">
                    <div class="call-item-name">${call.name || call.number || 'Unknown'}</div>
                    <div class="call-item-time">${call.time || ''}</div>
                </div>
                <span class="call-item-type ${typeClass}">${typeName}</span>
            </li>
        `;
    }).join('');
}

/**
 * Play ringtone for incoming call
 */
function playRingtone() {
    // Could add audio playback here
    // For now, rely on the phone's ringtone
}

/**
 * Stop ringtone
 */
function stopRingtone() {
    // Stop audio if playing
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (evtSource) {
        evtSource.close();
    }
});

