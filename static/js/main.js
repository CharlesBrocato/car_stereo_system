// Main menu JavaScript

// Update time display
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    const timeElement = document.getElementById('time');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// Update status from API
async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        // Update status indicator
        const statusIndicator = document.getElementById('status-indicator');
        if (statusIndicator) {
            if (data.music_playing) {
                statusIndicator.textContent = '🎵 Playing';
                statusIndicator.style.color = '#4CAF50';
            } else if (data.bluetooth_connected) {
                statusIndicator.textContent = '📶 Connected';
                statusIndicator.style.color = '#2196F3';
            } else {
                statusIndicator.textContent = '● Ready';
                statusIndicator.style.color = '#666';
            }
        }
        
        // Update sensor info
        if (data.sense_hat_data) {
            const tempElement = document.getElementById('temperature');
            const humidityElement = document.getElementById('humidity');
            
            if (tempElement && data.sense_hat_data.temperature) {
                tempElement.textContent = `${data.sense_hat_data.temperature}°C`;
            }
            if (humidityElement && data.sense_hat_data.humidity) {
                humidityElement.textContent = `${data.sense_hat_data.humidity}%`;
            }
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    updateStatus();
    
    // Update time every second
    setInterval(updateTime, 1000);
    
    // Update status every 5 seconds
    setInterval(updateStatus, 5000);
});

