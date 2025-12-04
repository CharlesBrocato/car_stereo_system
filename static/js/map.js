// Map navigation JavaScript
// Supports coordinates, street addresses, and POI navigation
// Location sources: Phone (Bluetooth) -> Pi (GPS/IP) -> Browser -> Default

let map;
let routeLayer;
let markers = [];
let poiMarkers = [];
let selectedPlace = null;

// Store current location globally for navigation
window.currentLocation = null;

// =============================================================================
// Location Services
// =============================================================================

async function getBestLocation() {
    /**
     * Get the best available location using this priority:
     * 1. Connected phone (via Bluetooth)
     * 2. Raspberry Pi (GPS or IP geolocation)
     * 3. Browser geolocation
     * 4. Default location
     */
    
    // Try backend location service (phone -> Pi)
    try {
        const response = await fetch('/api/location/current');
        const data = await response.json();
        if (data.ok && data.lat && data.lon) {
            console.log(`Location from ${data.source}: ${data.lat}, ${data.lon}`);
            return {
                lat: data.lat,
                lon: data.lon,
                source: data.source,
                city: data.city || ''
            };
        }
    } catch (e) {
        console.log('Backend location failed:', e);
    }
    
    // Fallback to browser geolocation
    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                    enableHighAccuracy: true
                });
            });
            console.log('Location from browser:', position.coords.latitude, position.coords.longitude);
            return {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                source: 'browser'
            };
        } catch (e) {
            console.log('Browser geolocation failed:', e);
        }
    }
    
    // Default location (Toronto)
    console.log('Using default location');
    return {
        lat: 43.6532,
        lon: -79.3832,
        source: 'default'
    };
}

// =============================================================================
// Map Initialization
// =============================================================================

async function initMap() {
    const defaultLocation = [43.6532, -79.3832];
    
    map = L.map('map').setView(defaultLocation, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Get best available location
    const location = await getBestLocation();
    window.currentLocation = location;
    
    const userLocation = [location.lat, location.lon];
    map.setView(userLocation, 14);
    
    const sourceText = location.source === 'default' ? 'Default Location' : 
                       location.source === 'browser' ? 'Your Location' :
                       location.source === 'phone' ? 'Your Location (Phone)' :
                       location.source === 'gps' ? 'Your Location (GPS)' :
                       location.source === 'ip' ? `Location (${location.city || 'IP'})` :
                       'Your Location';
    
    addMarker(userLocation, sourceText, location.source === 'default' ? 'gray' : 'blue');
    
    // Update UI
    const coordsDisplay = document.getElementById('current-coords');
    const locationInfo = document.getElementById('location-info');
    if (coordsDisplay) {
        coordsDisplay.textContent = `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
    }
    if (locationInfo && location.source !== 'default') {
        locationInfo.style.display = 'flex';
    }
}

// =============================================================================
// Use My Location
// =============================================================================

async function useMyLocation() {
    const locateBtn = document.getElementById('locate-btn');
    const originInput = document.getElementById('origin-input');
    const coordsDisplay = document.getElementById('current-coords');
    const locationInfo = document.getElementById('location-info');
    
    if (locateBtn) {
        locateBtn.disabled = true;
        locateBtn.innerHTML = '⏳ Finding...';
    }
    
    try {
        const location = await getBestLocation();
        window.currentLocation = location;
        
        if (originInput) {
            originInput.value = `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
        }
        
        if (coordsDisplay) {
            coordsDisplay.textContent = `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
        }
        if (locationInfo) {
            locationInfo.style.display = 'flex';
        }
        
        const userLocation = [location.lat, location.lon];
        map.setView(userLocation, 15);
        clearMarkers();
        addMarker(userLocation, 'Your Location', 'blue');
        
        showSuccess(`Location found (${location.source})`);
        
    } catch (error) {
        console.error('Location error:', error);
        showError('Could not determine your location');
    } finally {
        if (locateBtn) {
            locateBtn.disabled = false;
            locateBtn.innerHTML = '📍 Use My Location';
        }
    }
}

// =============================================================================
// Markers
// =============================================================================

function addMarker(location, popupText, color = 'blue') {
    const colorMap = {
        'blue': '#2196F3',
        'red': '#f44336',
        'green': '#4CAF50',
        'gray': '#9E9E9E',
        'orange': '#FF9800',
        'purple': '#9C27B0'
    };
    
    const markerColor = colorMap[color] || color;
    
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${markerColor};
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    const marker = L.marker(location, { icon }).addTo(map).bindPopup(popupText);
    markers.push(marker);
    return marker;
}

function addPoiMarker(place, index, isClosest = false) {
    const typeIcons = {
        'fuel': '⛽',
        'gas': '⛽',
        'restaurant': '🍽️',
        'food': '🍽️',
        'parking': '🅿️',
        'hospital': '🏥',
        'pharmacy': '💊',
        'charging': '🔌',
        'hotel': '🏨',
        'supermarket': '🛒'
    };
    
    const emoji = typeIcons[place.type] || '📍';
    const bgColor = isClosest ? '#4CAF50' : 'white';
    const textColor = isClosest ? 'white' : '#333';
    
    const icon = L.divIcon({
        className: 'poi-marker',
        html: `<div style="
            background: ${bgColor};
            color: ${textColor};
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            white-space: nowrap;
            border: 2px solid ${isClosest ? '#4CAF50' : '#ddd'};
        ">${emoji} ${index + 1}</div>`,
        iconSize: null
    });
    
    const marker = L.marker([place.lat, place.lon], { icon })
        .addTo(map)
        .bindPopup(`
            <b>${place.name}</b><br>
            ${place.distance_text}<br>
            ${place.address || ''}
            <br><br>
            <button onclick="navigateToPlace(${place.lat}, ${place.lon}, '${place.name.replace(/'/g, "\\'")}')">
                🧭 Navigate
            </button>
        `);
    
    // Click to select
    marker.on('click', () => {
        selectPlace(place, index);
    });
    
    poiMarkers.push(marker);
    return marker;
}

function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
}

function clearPoiMarkers() {
    poiMarkers.forEach(marker => map.removeLayer(marker));
    poiMarkers = [];
}

// =============================================================================
// Places Search with Panel
// =============================================================================

async function searchNearbyPlaces(placeType) {
    if (!window.currentLocation) {
        showError('Getting your location first...');
        await useMyLocation();
        if (!window.currentLocation) {
            showError('Could not get location');
            return;
        }
    }
    
    // Update button state
    const btn = document.getElementById(`btn-${placeType}`);
    document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
        btn.disabled = true;
        btn.innerHTML = `<span class="loading-spinner"></span>`;
    }
    
    // Show panel with loading state
    showPlacesPanel('Searching...', []);
    
    try {
        const url = `/api/places/nearby?lat=${window.currentLocation.lat}&lon=${window.currentLocation.lon}&type=${placeType}&radius=8000`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ok && data.results && data.results.length > 0) {
            // Clear old markers
            clearPoiMarkers();
            
            // Add markers for each place
            data.results.forEach((place, index) => {
                if (place.lat && place.lon) {
                    addPoiMarker(place, index, index === 0);
                }
            });
            
            // Show panel with results
            showPlacesPanel(data.type_name || placeType, data.results);
            
            // Fit map to show all markers
            if (poiMarkers.length > 0) {
                const group = new L.featureGroup(poiMarkers);
                map.fitBounds(group.getBounds().pad(0.1));
            }
            
        } else {
            showPlacesPanel(data.type_name || placeType, [], 'No places found nearby');
        }
    } catch (error) {
        console.error('Places search error:', error);
        showPlacesPanel(placeType, [], 'Search failed. Try again.');
    } finally {
        // Reset button
        if (btn) {
            btn.disabled = false;
            const icons = { fuel: '⛽', restaurant: '🍽️', parking: '🅿️', hospital: '🏥' };
            const names = { fuel: 'Gas Stations', restaurant: 'Restaurants', parking: 'Parking', hospital: 'Hospitals' };
            btn.innerHTML = `${icons[placeType] || '📍'} ${names[placeType] || placeType}`;
        }
    }
}

function showPlacesPanel(title, places, errorMsg = null) {
    const panel = document.getElementById('places-panel');
    const panelTitle = document.getElementById('places-panel-title');
    const placesCount = document.getElementById('places-count');
    const placesList = document.getElementById('places-list');
    
    panel.classList.add('visible');
    panelTitle.textContent = title;
    
    if (errorMsg) {
        placesCount.textContent = '';
        placesList.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">😕</div>
                <div>${errorMsg}</div>
            </div>
        `;
        return;
    }
    
    if (places.length === 0) {
        placesCount.textContent = 'Searching...';
        placesList.innerHTML = `
            <div class="no-results">
                <div class="loading-spinner" style="border-top-color: #667eea;"></div>
            </div>
        `;
        return;
    }
    
    placesCount.textContent = `Found ${places.length} nearby`;
    
    placesList.innerHTML = places.map((place, index) => `
        <div class="place-card ${index === 0 ? 'closest' : ''}" 
             data-index="${index}"
             onclick="selectPlace(window._places[${index}], ${index})">
            <div class="place-card-name">
                ${index + 1}. ${place.name}
                ${index === 0 ? '<span class="closest-badge">CLOSEST</span>' : ''}
            </div>
            <div class="place-card-distance">📍 ${place.distance_text}</div>
            ${place.address ? `<div class="place-card-address">${place.address}</div>` : ''}
            <button class="place-card-btn" onclick="event.stopPropagation(); navigateToPlace(${place.lat}, ${place.lon}, '${place.name.replace(/'/g, "\\'")}')">
                🧭 Navigate Here
            </button>
        </div>
    `).join('');
    
    // Store places for click handlers
    window._places = places;
}

function closePlacesPanel() {
    const panel = document.getElementById('places-panel');
    panel.classList.remove('visible');
    clearPoiMarkers();
    document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
    
    // Recenter on user location
    if (window.currentLocation) {
        map.setView([window.currentLocation.lat, window.currentLocation.lon], 14);
    }
}

function selectPlace(place, index) {
    selectedPlace = place;
    
    // Update card highlighting
    document.querySelectorAll('.place-card').forEach((card, i) => {
        card.classList.remove('selected');
        if (i === index) {
            card.classList.add('selected');
        }
    });
    
    // Center map on place
    map.setView([place.lat, place.lon], 16);
    
    // Open popup
    if (poiMarkers[index]) {
        poiMarkers[index].openPopup();
    }
}

// =============================================================================
// Navigation to Place
// =============================================================================

async function navigateToPlace(lat, lon, name) {
    if (!window.currentLocation) {
        showError('Please get your location first');
        return;
    }
    
    showSuccess(`Getting route to ${name}...`);
    
    try {
        const url = `/api/route/to_place?start_lat=${window.currentLocation.lat}&start_lon=${window.currentLocation.lon}&lat=${lat}&lon=${lon}&name=${encodeURIComponent(name)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ok || data.success) {
            // Close places panel
            closePlacesPanel();
            
            // Display route
            displayRoute(data);
            
            // Update destination input
            const destInput = document.getElementById('dest-input');
            if (destInput) {
                destInput.value = name;
            }
            
            // Show route info
            showRouteInfo(data);
            
        } else {
            showError(data.error || data.message || 'Could not calculate route');
        }
    } catch (error) {
        console.error('Navigation error:', error);
        showError('Failed to get directions');
    }
}

// Make navigateToPlace available globally
window.navigateToPlace = navigateToPlace;

// =============================================================================
// UI Helpers
// =============================================================================

function setLoading(isLoading) {
    const routeBtn = document.getElementById('route-btn');
    if (routeBtn) {
        if (isLoading) {
            routeBtn.disabled = true;
            routeBtn.innerHTML = '⏳ Finding route...';
        } else {
            routeBtn.disabled = false;
            routeBtn.innerHTML = 'Get Directions';
        }
    }
}

function showSuccess(message) {
    let panel = document.getElementById('success-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'success-panel';
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4);
            z-index: 2000;
            font-weight: 600;
        `;
        document.body.appendChild(panel);
    }
    
    panel.innerHTML = `✓ ${message}`;
    panel.style.display = 'block';
    
    setTimeout(() => { panel.style.display = 'none'; }, 3000);
}

function showRouteInfo(data) {
    let infoPanel = document.getElementById('route-info-panel');
    if (!infoPanel) {
        infoPanel = document.createElement('div');
        infoPanel.id = 'route-info-panel';
        infoPanel.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            margin-top: 15px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        `;
        document.querySelector('.map-controls').appendChild(infoPanel);
    }
    
    const destName = data.destination_name || 'Destination';
    
    infoPanel.innerHTML = `
        <h4 style="margin: 0 0 10px 0; font-size: 1.1em;">🧭 Route to ${destName}</h4>
        <div style="display: flex; justify-content: space-between; gap: 20px;">
            <div>
                <div style="opacity: 0.8; font-size: 0.85em;">Distance</div>
                <div style="font-size: 1.2em; font-weight: 600;">${data.distance}</div>
            </div>
            <div>
                <div style="opacity: 0.8; font-size: 0.85em;">Est. Time</div>
                <div style="font-size: 1.2em; font-weight: 600;">${data.duration}</div>
            </div>
        </div>
    `;
    infoPanel.style.display = 'block';
}

function hideRouteInfo() {
    const infoPanel = document.getElementById('route-info-panel');
    if (infoPanel) {
        infoPanel.style.display = 'none';
    }
}

function showError(message) {
    let errorPanel = document.getElementById('error-panel');
    if (!errorPanel) {
        errorPanel = document.createElement('div');
        errorPanel.id = 'error-panel';
        errorPanel.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            box-shadow: 0 4px 15px rgba(235, 51, 73, 0.4);
            z-index: 2000;
            font-weight: 600;
        `;
        document.body.appendChild(errorPanel);
    }
    
    errorPanel.innerHTML = `⚠️ ${message}`;
    errorPanel.style.display = 'block';
    
    setTimeout(() => { errorPanel.style.display = 'none'; }, 4000);
}

// =============================================================================
// Routing
// =============================================================================

async function calculateRoute(origin, destination) {
    setLoading(true);
    hideRouteInfo();
    
    try {
        const response = await fetch('/api/map/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination })
        });
        const data = await response.json();
        
        if (data.success) {
            displayRoute(data);
            showRouteInfo(data);
        } else {
            showError(data.message || 'Route calculation failed');
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        showError('Network error - please try again');
    } finally {
        setLoading(false);
    }
}

function displayRoute(data) {
    clearMarkers();
    clearPoiMarkers();
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    
    const waypoints = data.waypoints;
    
    if (waypoints && waypoints.length >= 2) {
        const origin = waypoints[0];
        const destination = waypoints[waypoints.length - 1];
        
        const originLabel = data.origin_input || `${origin[0].toFixed(4)}, ${origin[1].toFixed(4)}`;
        const destLabel = data.destination_name || data.destination_input || `${destination[0].toFixed(4)}, ${destination[1].toFixed(4)}`;
        
        const originIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background: #11998e; color: white; padding: 8px 14px; border-radius: 20px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">📍 Start</div>',
            iconSize: null
        });
        
        const destIcon = L.divIcon({
            className: 'custom-marker', 
            html: '<div style="background: #eb3349; color: white; padding: 8px 14px; border-radius: 20px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">🎯 ' + (destLabel.length > 20 ? destLabel.substring(0, 20) + '...' : destLabel) + '</div>',
            iconSize: null
        });
        
        L.marker(origin, {icon: originIcon}).addTo(map).bindPopup(`<b>Start:</b><br>${originLabel}`);
        L.marker(destination, {icon: destIcon}).addTo(map).bindPopup(`<b>Destination:</b><br>${destLabel}`);
        
        routeLayer = L.polyline(waypoints, {
            color: '#667eea',
            weight: 6,
            opacity: 0.9
        }).addTo(map);
        
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
    }
}

// =============================================================================
// Event Listeners
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    // Route button
    const routeBtn = document.getElementById('route-btn');
    if (routeBtn) {
        routeBtn.addEventListener('click', async () => {
            const originInput = document.getElementById('origin-input');
            const destInput = document.getElementById('dest-input');
            
            const origin = originInput.value.trim();
            const destination = destInput.value.trim();
            
            if (!origin || !destination) {
                showError('Please enter both starting point and destination');
                return;
            }
            
            await calculateRoute(origin, destination);
        });
    }
    
    // Locate button
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', useMyLocation);
    }
});

// Make functions available globally
window.searchNearbyPlaces = searchNearbyPlaces;
window.closePlacesPanel = closePlacesPanel;
window.selectPlace = selectPlace;
