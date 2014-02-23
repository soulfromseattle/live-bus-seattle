$(function() {
    var wsUri = 'ws://busdrone.com:28737/';

    var templates = {
        table: '<table><tbody>{body}</tbody></table>',
        row:'<tr><th>{key}</th><td>{value}</td></tr>',
        link:'<tr><th>{key}</th><td><a href="{href}" target="_blank">{title}</a></td></tr>',
        busMarker: '<div class="bus-route" style="border-bottom-color: {color};">{route}</div>'
    };

    var osm = L.tileLayer('http://{s}.tile2.opencyclemap.org/transport/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors,' +
            'tiles from <a href="http://www.opencyclemap.org/">OpenTransportMap</a>'
    });

    var map = L.map('map', {
        center: [47.6210, -122.3328],
        zoom: 13,
        layers: [osm]
    });

    L.control.locate().addTo(map);

    // the markers
    var markers = {};

    // the line
    var line;

    function debug(val) {
      console.log(val);
    }

    function wsConnect() {
      debug('Connecting to ' + wsUri);
      websocket = new WebSocket(wsUri);
      websocket.onopen = function(evt) { onWsOpen(evt) };
      websocket.onmessage = function(evt) { onWsMessage(evt) };
      websocket.onerror = function(evt) { onWsError(evt) };
      websocket.onclose = function(evt) { onWsClose(evt) };
    }

    function onWsOpen(evt) {
      debug('Connected');
    }

    function onWsClose(evt) {
      debug('Disconnected');
      window.setTimeout(wsConnect, Math.random() * 1000 * 25 + 5);
    }

    function onWsMessage(evt) {
      var data = JSON.parse(evt.data);

      if (data.type == 'update_vehicle') {
            var vehicle = data.vehicle;
            var marker = markers[vehicle.vehicleId];
            if (marker === undefined) {
                marker = addVehicle(data.vehicle);
            }
            marker.setLatLng([vehicle.lat, vehicle.lon]);
        } else if (data.type == 'init') {
            data.vehicles.forEach(addVehicle);
        } else if (data.type == 'remove_vehicle') {
            map.removeLayer(data.markers[vehicle.vehicleId]);
        } else if (data.type == 'trip_polyline') {
            if (line !== undefined) {
                map.removeLayer(line);
            }
            line = L.Polyline.fromEncoded(data.polyline, {
                color: 'red',
                weight: 3,
                opacity: .9
            }).addTo(map);
        } else {
            debug(data);
        }
    }

    function addVehicle(vehicle) {
        var body = '';
        jQuery.each(vehicle, function(key, value){
            body += L.Util.template(templates.row, {key: key, value: value});
        });
        trip_status_url = "http://api.pugetsound.onebusaway.org/api/where/trip-for-vehicle/" + vehicle.vehicleId + ".json?key=TEST";
        body += L.Util.template(templates.link, {key: "OneBusAway API", title: "Trip Status", href: trip_status_url});

        var icon = new L.divIcon({
            iconSize: 30,
            className: "bus",
            html: L.Util.template(templates.busMarker, {route: vehicle.route, color: vehicle.color.substring(0,7)})
        });

        var popupContent = L.Util.template(templates.table, {body: body});
        markers[vehicle.vehicleId] = L.marker([vehicle.lat, vehicle.lon], {icon: icon})
            //.bindPopup(popupContent)
            .on('click', function(e) {
                websocket.send(JSON.stringify({type: "trip_polyline", trip_uid: vehicle.dataProvider + "/" + vehicle.tripId}))
            })
            .addTo(map);
    }

    function getAge(vehicle) {
      var vehicle = (new Date() - vehicle.timestamp) / 1000 / 60;
      return vehicle;
    }

    // start by connecting to the web socket
    wsConnect();

    var hash = new L.Hash(map);
});

