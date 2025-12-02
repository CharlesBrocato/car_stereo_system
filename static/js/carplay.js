// CarPlay Controller JavaScript
// Manages FastCarPlay integration with Flask backend

class CarPlayController {
    constructor() {
        this.isRunning = false;
        this.statusInterval = null;
        this.init();
    }
    
    init() {
        // Bind button events
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-stop').addEventListener('click', () => this.stop());
        document.getElementById('btn-fullscreen').addEventListener('click', () => this.startFullscreen());
        document.getElementById('btn-restart').addEventListener('click', () => this.restart());
        
        // Initial status check
        this.updateStatus();
        
        // Poll status every 3 seconds
        this.statusInterval = setInterval(() => this.updateStatus(), 3000);
    }
    
    async start(fullscreen = false) {
        const btn = document.getElementById('btn-start');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="loading-spinner"></span> Starting...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/carplay/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullscreen: fullscreen })
            });
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('CarPlay started successfully!', 'success');
            } else {
                this.showNotification(data.message || 'Failed to start CarPlay', 'error');
            }
            
            this.updateStatus();
        } catch (error) {
            console.error('Start error:', error);
            this.showNotification('Error starting CarPlay', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
    
    async startFullscreen() {
        await this.start(true);
    }
    
    async stop() {
        const btn = document.getElementById('btn-stop');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="loading-spinner"></span> Stopping...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/carplay/stop', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('CarPlay stopped', 'info');
            } else {
                this.showNotification(data.message || 'Failed to stop CarPlay', 'error');
            }
            
            this.updateStatus();
        } catch (error) {
            console.error('Stop error:', error);
            this.showNotification('Error stopping CarPlay', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
    
    async restart() {
        const btn = document.getElementById('btn-restart');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="loading-spinner"></span> Restarting...';
        btn.disabled = true;
        
        try {
            const response = await fetch('/api/carplay/restart', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('CarPlay restarted successfully!', 'success');
            } else {
                this.showNotification(data.message || 'Failed to restart CarPlay', 'error');
            }
            
            this.updateStatus();
        } catch (error) {
            console.error('Restart error:', error);
            this.showNotification('Error restarting CarPlay', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
    
    async updateStatus() {
        try {
            const response = await fetch('/api/carplay/status');
            const data = await response.json();
            
            this.isRunning = data.running;
            this.updateUI(data);
        } catch (error) {
            console.error('Status update error:', error);
        }
    }
    
    updateUI(status) {
        const statusCard = document.getElementById('status-card');
        const statusIcon = document.getElementById('status-icon');
        const statusTitle = document.getElementById('status-title');
        const statusDesc = document.getElementById('status-description');
        const btnStart = document.getElementById('btn-start');
        const btnStop = document.getElementById('btn-stop');
        const navKeys = document.getElementById('nav-keys');
        
        // Update dongle status
        const dongleStatus = document.getElementById('dongle-status');
        if (status.dongle_detected) {
            dongleStatus.textContent = 'Connected';
            dongleStatus.classList.add('success');
            dongleStatus.classList.remove('warning');
        } else {
            dongleStatus.textContent = 'Not Found';
            dongleStatus.classList.add('warning');
            dongleStatus.classList.remove('success');
        }
        
        // Update engine status
        const engineStatus = document.getElementById('engine-status');
        if (status.built) {
            engineStatus.textContent = status.running ? 'Running' : 'Ready';
            engineStatus.classList.add('success');
            engineStatus.classList.remove('warning');
        } else {
            engineStatus.textContent = 'Not Built';
            engineStatus.classList.add('warning');
            engineStatus.classList.remove('success');
        }
        
        // Update device status
        const deviceStatus = document.getElementById('device-status');
        if (status.connected_device) {
            deviceStatus.textContent = status.connected_device;
            deviceStatus.classList.add('success');
            deviceStatus.classList.remove('warning');
        } else {
            deviceStatus.textContent = status.running ? 'Waiting...' : 'None';
            deviceStatus.classList.remove('success');
        }
        
        // Update main status card
        statusCard.classList.remove('connected', 'running', 'error');
        
        if (status.running) {
            if (status.status === 'connected') {
                statusCard.classList.add('connected');
                statusIcon.textContent = '📱';
                statusIcon.classList.add('connected');
                statusTitle.textContent = 'Device Connected';
                statusDesc.textContent = status.connected_device || 'CarPlay / Android Auto active';
            } else {
                statusCard.classList.add('running');
                statusIcon.textContent = '📡';
                statusIcon.classList.remove('connected');
                statusTitle.textContent = 'CarPlay Running';
                statusDesc.textContent = 'Waiting for device connection...';
            }
            
            // Show stop button, hide start button
            btnStart.classList.add('hidden');
            btnStop.classList.remove('hidden');
            navKeys.classList.remove('hidden');
        } else {
            if (status.error) {
                statusCard.classList.add('error');
                statusIcon.textContent = '⚠️';
                statusTitle.textContent = 'Error';
                statusDesc.textContent = status.error;
            } else {
                statusIcon.textContent = '🔌';
                statusIcon.classList.remove('connected');
                statusTitle.textContent = 'CarPlay Not Active';
                statusDesc.textContent = status.built 
                    ? 'Click Start to launch CarPlay receiver' 
                    : 'Run build script first: ./build_carplay.sh';
            }
            
            // Show start button, hide stop button
            btnStart.classList.remove('hidden');
            btnStop.classList.add('hidden');
            navKeys.classList.add('hidden');
        }
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        `;
        
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Send navigation key to CarPlay
async function sendKey(key) {
    try {
        const response = await fetch('/api/carplay/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key })
        });
        const data = await response.json();
        
        if (!data.success) {
            console.warn('Key send failed:', data.message);
        }
    } catch (error) {
        console.error('Key send error:', error);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.carplayController = new CarPlayController();
});

