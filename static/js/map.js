// Map navigation JavaScript

let map;
let routeLayer;

// Initialize map
function initMap() {
    // Default location (Toronto - adjust as needed)
    const defaultLocation = [43.6532, -79.3832];
    
    map = L.map('map').setView(defaultLocation, 13);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = [position.coords.latitude, position.coords.longitude];
                map.setView(userLocation, 15);
                L.marker(userLocation).addTo(map).bindPopup('Your Location').openPopup();
            },
            (error) => {
                console.log('Geolocation error:', error);
                // Use default location
                L.marker(defaultLocation).addTo(map).bindPopup('Default Location');
            }
        );
    } else {
        // Use default location
        L.marker(defaultLocation).addTo(map).bindPopup('Default Location');
    }
}

// Get route
const routeBtn = document.getElementById('route-btn');
if (routeBtn) {
    routeBtn.addEventListener('click', async () => {
        const originInput = document.getElementById('origin-input');
        const destInput = document.getElementById('dest-input');
        
        const origin = originInput.value.trim();
        const destination = destInput.value.trim();
        
        if (!origin || !destination) {
            alert('Please enter both origin and destination');
            return;
        }
        
        await calculateRoute(origin, destination);
    });
}

async function calculateRoute(origin, destination) {
    try {
        const response = await fetch('/api/map/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination })
        });
        const data = await response.json();
        
        if (data.success) {
            displayRoute(data.waypoints);
        } else {
            alert('Route calculation failed: ' + data.message);
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        alert('Error calculating route');
    }
}

function displayRoute(waypoints) {
    // Remove existing route layer
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    // Add markers for origin and destination
    if (waypoints.length >= 2) {
        const origin = waypoints[0];
        const destination = waypoints[waypoints.length - 1];
        
        L.marker(origin).addTo(map).bindPopup('Origin');
        L.marker(destination).addTo(map).bindPopup('Destination');
        
        // Draw route line (simplified - in production, use proper routing service)
        routeLayer = L.polyline(waypoints, {
            color: '#667eea',
            weight: 5,
            opacity: 0.7
        }).addTo(map);
        
        // Fit map to show entire route
        map.fitBounds(routeLayer.getBounds());
    }
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', () => {
    initMap();
});

