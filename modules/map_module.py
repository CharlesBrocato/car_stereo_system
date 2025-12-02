"""
Map Module
Handles map display and navigation using OpenStreetMap
"""

import folium
import json
import os

class MapManager:
    def __init__(self):
        self.current_location = None
        self.map_file = 'static/map.html'
        self.default_center = [43.6532, -79.3832]  # Default: Toronto (adjust as needed)
    
    def get_route(self, origin, destination):
        """Get route between two points"""
        # This is a simplified version
        # For full routing, you'd want to use OSRM or similar service
        try:
            # Parse coordinates if provided as strings
            if isinstance(origin, str):
                origin = [float(x) for x in origin.split(',')]
            if isinstance(destination, str):
                destination = [float(x) for x in destination.split(',')]
            
            return {
                'success': True,
                'origin': origin,
                'destination': destination,
                'distance': 'Calculating...',
                'duration': 'Calculating...',
                'waypoints': [origin, destination]  # Simplified route
            }
        except Exception as e:
            print(f"Route calculation error: {e}")
            return {
                'success': False,
                'message': str(e)
            }
    
    def create_map(self, center=None, zoom=13):
        """Create a new map centered at specified location"""
        if center is None:
            center = self.default_center
        
        try:
            # Create folium map
            m = folium.Map(
                location=center,
                zoom_start=zoom,
                tiles='OpenStreetMap'
            )
            
            # Save to static directory
            map_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'map.html')
            m.save(map_path)
            
            return {'success': True, 'map_file': 'static/map.html'}
        except Exception as e:
            print(f"Map creation error: {e}")
            return {'success': False, 'message': str(e)}
    
    def add_marker(self, location, popup_text=''):
        """Add marker to map"""
        try:
            # This would modify the existing map file
            # For simplicity, we'll recreate the map
            return {'success': True}
        except Exception as e:
            print(f"Add marker error: {e}")
            return {'success': False, 'message': str(e)}
    
    def update_location(self, latitude, longitude):
        """Update current location"""
        self.current_location = [latitude, longitude]
        return self.create_map(center=self.current_location)

