const searchBoxOrigin = document.getElementById('search-box-origin');
const suggestionsOriginDiv = document.getElementById('suggestions-origin');
const searchBoxDest = document.getElementById('search-box-dest');
const suggestionsDestDiv = document.getElementById('suggestions-dest');
const calculateRouteButton = document.getElementById('calculate-route-button');

let map; // Initialize the map after page loads
let originMarker = null; // Store origin marker
let destMarker = null; // Store destination marker
let routeLine; // Store the route line
let allBases = {}; // Use an object to store all fetched bases

document.addEventListener('DOMContentLoaded', () => {
    map = L.map('map').setView([37.8, -96], 4); // Center on the US and zoom out

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
});

addSearchEventListener(searchBoxOrigin, suggestionsOriginDiv, true); // true for origin
addSearchEventListener(searchBoxDest, suggestionsDestDiv, false); // false for destination
calculateRouteButton.addEventListener("click", handleRouteCalculation);

function addSearchEventListener(searchBox, suggestionsDiv, isOrigin) {
    searchBox.addEventListener("input", () => {
        const searchText = searchBox.value.trim();
        if (searchText.length > 2) {
            fetch(`http://127.0.0.1:5000/search?q=${searchText}`)
                .then(response => response.json())
                .then(data => {
                    // Store fetched bases in allBases
                    data.forEach(base => {
                        allBases[base.base_name] = base;
                    });
                    showSuggestions(data, searchBox, suggestionsDiv, isOrigin);
                })
                .catch(error => {
                    console.error("Error fetching suggestions:", error);
                });
        } else {
            suggestionsDiv.style.display = "none";
        }
    });
}

function showSuggestions(bases, searchBox, suggestionsDiv, isOrigin) {
    suggestionsDiv.innerHTML = "";
    if (bases.length === 0) {
        suggestionsDiv.style.display = "none";
        return;
    }

    const ul = document.createElement('ul');
    bases.forEach(base => {
        const li = document.createElement('li');
        li.textContent = base.base_name;
        li.addEventListener("click", () => {
            searchBox.value = base.base_name;
            suggestionsDiv.style.display = "none";

            updateMarker(base, isOrigin);
            checkAndCreateRoute();
        });
        ul.appendChild(li);
    });

    suggestionsDiv.appendChild(ul);
    suggestionsDiv.style.display = "block";
}

function updateMarker(base, isOrigin) {
    if (base.latitude && base.longitude) {
        // Remove existing marker for origin or destination if it exists
        if (isOrigin && originMarker) {
            map.removeLayer(originMarker);
            originMarker = null;
        } else if (!isOrigin && destMarker) {
            map.removeLayer(destMarker);
            destMarker = null;
        }

        // Add a new marker
        const marker = L.marker([base.latitude, base.longitude]).addTo(map);
        marker.bindPopup(base.base_name); // Add a popup with the base name

        // Store the marker as either origin or destination
        if (isOrigin) {
            originMarker = marker;
        } else {
            destMarker = marker;
        }

        // Center the map on the selected base
        map.setView([base.latitude, base.longitude], 10); // Adjust the zoom level as needed

        // Calculate pixel coordinates for routing control BEFORE centering the map
        if (searchBoxOrigin.value && searchBoxDest.value) {
            const originBase = allBases[searchBoxOrigin.value.trim().toLowerCase()];
            const destBase = allBases[searchBoxDest.value.trim().toLowerCase()];

            if (originBase && destBase) {
                const origin = L.latLng(originBase.latitude, originBase.longitude);
                const destination = L.latLng(destBase.latitude, destBase.longitude);
                const midPoint = getMidPoint(origin, destination);

                const originPoint = map.latLngToContainerPoint(origin);
                const destinationPoint = map.latLngToContainerPoint(destination);
                const midPointPixel = map.latLngToContainerPoint(midPoint);
                createRoutingControl(originPoint, destinationPoint, midPointPixel);
            }
        }
    }
}

function createRoutingControl(originPoint, destinationPoint, midPointPixel) {
    // Remove existing route line if it exists
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    // Check if both origin and destination are selected
    if (!originPoint || !destinationPoint) {
        console.log("Origin or destination not selected");
        return;
    }

    console.log("Creating route line...");
    console.log("Origin point:", originPoint);
    console.log("Destination point:", destinationPoint);
    console.log("Midpoint pixel:", midPointPixel);

    // Create a great-circle path using Leaflet.curve and pixel coordinates
    routeLine = L.curve([
        'M', originPoint,
        'Q', midPointPixel,
        destinationPoint
    ], {
        color: 'blue',
        weight: 3,
    }).addTo(map);

    console.log("Route line created:", routeLine);

    // Fit the map view to the bounds of the route
    map.fitBounds(routeLine.getBounds());
}

function checkAndCreateRoute() {
    if (originMarker && destMarker) {
        const originPoint = map.latLngToContainerPoint(originMarker.getLatLng());
        const destinationPoint = map.latLngToContainerPoint(destMarker.getLatLng());
        const midPoint = getMidPoint(originMarker.getLatLng(), destMarker.getLatLng());
        const midPointPixel = map.latLngToContainerPoint(midPoint);
        createRoutingControl(originPoint, destinationPoint, midPointPixel);
    }
}

// Helper function to get a midpoint for the curve (for a more curved appearance)
function getMidPoint(latlng1, latlng2) {
    const offset = 0.6;
    const lat = (latlng1.lat + latlng2.lat) / 2;
    const lng = (latlng1.lng + latlng2.lng) / 2;
    const offsetX = (latlng2.lng - latlng1.lng) * offset;
    const offsetY = (latlng2.lat - latlng1.lat) * offset;
    return L.latLng(lat + offsetY, lng + offsetX);
}

function handleRouteCalculation() {
    // zoom out map
    map.setView([37.8, -96], 4);

    // ensure both origin and destination are selected
    if (searchBoxOrigin.value && searchBoxDest.value) {

        console.log("allBases:", allBases);

        const originBase = allBases[searchBoxOrigin.value.trim()];
        const destBase = allBases[searchBoxDest.value.trim()];

        console.log("Origin base:", originBase);
        console.log("Destination base:", destBase);

        if (originBase && destBase) {
            // convert LatLng to pixel coordinates after zooming out
            const origin = L.latLng(originBase.latitude, originBase.longitude);
            const destination = L.latLng(destBase.latitude, destBase.longitude);
            const midPoint = getMidPoint(origin, destination);

            const originPoint = map.latLngToContainerPoint(origin);
            const destinationPoint = map.latLngToContainerPoint(destination);
            const midPointPixel = map.latLngToContainerPoint(midPoint);
            
            // log the points for debugging
            console.log("handling route calculation...");
            console.log("Origin point:", originPoint);
            console.log("Destination point:", destinationPoint);
            console.log("Midpoint pixel:", midPointPixel);
            
            createRoutingControl(originPoint, destinationPoint, midPointPixel);
        } else {
            console.error("Could not find origin or destination base data.");

        }
    } else {
        console.error("Both origin and destination bases must be selected.");
    }
}