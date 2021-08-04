let map;
const ICON_LIST = {
  "1": {
    url: "../assets/image/1.png",
    icon: undefined,
    zindex: 50
  },
  "2": {
    url: "../assets/image/2.png",
    icon: undefined,
    zindex: 60
  },
  "3": {
    url: "../assets/image/3.png",
    icon: undefined,
    zindex: 70
  },
  "4": {
    url: "../assets/image/4.png",
    icon: undefined,
    zindex: 80
  },
  "震度５弱以上未入電": {
    url: "../assets/image/5l_nodata.png",
    icon: undefined,
    zindex: 90
  },
  "5-": {
    url: "../assets/image/5l.png",
    icon: undefined,
    zindex: 100
  },
  "5+": {
    url: "../assets/image/5h.png",
    icon: undefined,
    zindex: 110
  },
  "6-": {
    url: "../assets/image/6l.png",
    icon: undefined,
    zindex: 120
  },
  "6+": {
    url: "../assets/image/6h.png",
    icon: undefined,
    zindex: 130
  },
  "7": {
    url: "../assets/image/7.png",
    icon: undefined,
    zindex: 140
  },
};

const P2P_INT_COLOR = {
  "10": "#99ffff",
  "20": "#3399ff",
  "30": "#00ff00",
  "40": "#ffff33",
  "45": "#ffaa00",
  "50": "#ff4000",
  "55": "#ff0000",
  "60": "#c41d3b",
  "70": "#960096",
};

$(window).on("load", function () {
  map = L.map("map", {
    zoomControl: true,
    minZoom: 4,
    maxZoom: 13,
    preferCanvas: true,
  });
  map.setView([34.144, 135.527], 5);

  map.zoomControl.setPosition("topright");
  map.createPane("base").style.zIndex = 40;

  var std_map = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>",
    pane: "base"
  });
  var pale_map = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>",
    pane: "base"
  }).addTo(map);
  var white_map = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>",
    pane: "base"
  });
  var hill_map = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>",
    pane: "base"
  });
  var seamlessphoto_map = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>",
    pane: "base"
  });
  var os_map = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: "© <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
    pane: "base"
  });
  var dark_map = L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png", {
    attribution: "地図データ：CARTO",
    pane: "base"
  });
  var arcgis_map = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "地図データ：Esri &mdash; Source,Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    pane: "base"
  });

  var myMaps = {
    "地理院地図 標準": std_map,
    "地理院地図 淡色": pale_map,
    "地理院地図 白地図": white_map,
    "地理院地図 陰影起伏図": hill_map,
    "地理院地図 写真": seamlessphoto_map,
    "OpenStreetMap": os_map,
    "CartoDB DarkMatter": dark_map,
    "Esri WorldImagery": arcgis_map
  }
  L.control.layers(myMaps).addTo(map);
  map.attributionControl.addAttribution("地震情報：<a href='https://www.jma.go.jp/'>気象庁</a> API提供：P2P地震情報");

  //アイコン追加処理
  let icon_key = Object.keys(ICON_LIST);
  for (let i = 0; i < icon_key.length; i++) {
    ICON_LIST[icon_key[i]].icon = L.icon({
      iconUrl: ICON_LIST[icon_key[i]].url,
      iconSize: [20, 20]
    });
    map.createPane("intpane" + icon_key[i]).style.zIndex = ICON_LIST[icon_key[i]].zindex;
  }

  $.getJSON("assets/stations.json")
    .done(function (data) {
      ShindoObsPoint = data;

      $.getJSON("https://api.p2pquake.net/v2/jma/quake")
        .done(function (data) {
          P2P_quakeget(data[0]);
        });

      P2PsocketStart;
    });
});

//P2P地震情報websocket接続
let P2PsocketStart = (() => {
  const socketStartUrl = 'wss://api.p2pquake.net/v2/ws';

  const websocket = new WebSocket(socketStartUrl);
  websocket.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);

    if (msg.code === 551)
      P2P_quakeget(msg);
    date = new Date();
    console.log(date.toLocaleString("ja"), msg);

    websocket.addEventListener('close', () => {
      console.log('WebSocket closed.');
      setTimeout(P2PsocketStart, 20000);
    });
  });
})();

//P2P地震情報プロット
let marker_list = undefined;
let jma_int = undefined;
let fill_layer = undefined;

function P2P_quakeget(msg) {
  if (marker_list !== undefined) {
    map.removeLayer(marker_list);
  }
  if (fill_layer != undefined) {
    map.removeLayer(fill_layer);
  }

  console.log(msg);

  marker_list = L.featureGroup();

  //震度速報
  if (msg.issue.type === "ScalePrompt") {
    //地震メインのJSONと地図データ（塗りつぶし）を読み込む
    $.getJSON("../assets/japan_quake.json", function (mdata) {
      let fill_data = [];

      msg.points.forEach((area_data) => {
        let add_obj = {
          name: area_data.addr, //String(area_data.addr)でもok(てかそっちのほうがいいかも)
          int: area_data.scale,
        };
        fill_data.push(add_obj);
      });

      //拡大用に定義
      let bound = L.latLngBounds();

      //塗りつぶし
      let fill_geoobje = topojson.feature(mdata, mdata.objects.japan_quake);
      fill_layer = L.geoJson(fill_geoobje, {
        onEachFeature: function (feature, layer) {
          let mapname = feature.properties.name;
          let code_index = fill_data.findIndex(({ name }) => name === mapname);
          if (code_index !== -1 && mapname == fill_data[code_index].name) {
            bound.extend([layer._bounds._northEast, layer._bounds._southWest]);

            let int = undefined;
            switch (fill_data[code_index].int) {
              case 10:
                int = "1";
                break;
              case 20:
                int = "2";
                break;
              case 30:
                int = "3";
                break;
              case 40:
                int = "4";
                break;
              case 45:
                int = "5-";
                break;
              case 50:
                int = "5+";
                break;
              case 55:
                int = "6-";
                break;
              case 60:
                int = "6+";
                break;
              case 70:
                int = "7";
                break;
              case 46:
                int = "震度5弱以上未入電";
                break;
            }
            //ポップアップ設定
            layer.bindPopup("<p>震度" + int + "： " + fill_data[code_index].name + "</p>");
          }
        },
        style: function (feature) {
          let fill_color = "transparent";
          let mapname = feature.properties.name;
          let code_index = fill_data.findIndex(({ name }) => name === mapname);
          if (code_index !== -1 && mapname == fill_data[code_index].name) {
            fill_color = P2P_INT_COLOR[fill_data[code_index].int];
          }

          return {
            fillColor: fill_color,
            fillOpacity: 0.75,
            opacity: 0.85,
            weight: 1,
            color: "#656565",
            //pane: "fill", //未定義のpaneはエラーの原因 //http://localhost:5500/%E5%9C%B0%E9%9C%87%E6%83%85%E5%A0%B1%E9%96%A2%E9%80%A3/Earthquake_fast/index.html
          };
        },
      }).addTo(map);
      //塗りつぶし・震源にあわせて拡大
      map.fitBounds(bound);
    });
  }

  //震源アイコン
  if (msg.issue.type === "DetailScale" || msg.issue.type === "Destination") {
    switch (msg.earthquake.maxScale) {
      case 10:
        max_int = "1";
        break;
      case 20:
        max_int = "2";
        break;
      case 30:
        max_int = "3";
        break;
      case 40:
        max_int = "4";
        break;
      case 45:
        max_int = "5弱";
        break;
      case 50:
        max_int = "5強";
        break;
      case 55:
        max_int = "6弱";
        break;
      case 60:
        max_int = "6強";
        break;
      case 70:
        max_int = "7";
        break;
    }
    if (msg.earthquake.hypocenter.depth === 0) {
      depth_txt = "ごく浅い";
    } else {
      depth_txt = msg.earthquake.hypocenter.depth + "km";
    }
    let hypo_marker = L.marker([msg.earthquake.hypocenter.latitude, msg.earthquake.hypocenter.longitude],
      {
        icon: L.icon({
          iconUrl: "../assets/image/epicenter.png",
          iconSize: [25, 25]
        })
      }).bindPopup(`${msg.earthquake.hypocenter.name} ${msg.earthquake.hypocenter.latitude},${msg.earthquake.hypocenter.longitude}` +
        `<br>最大震度${max_int}<br>深さ${depth_txt}<br>M${msg.earthquake.hypocenter.magnitude}`);
    marker_list.addLayer(hypo_marker);
  }

  if (msg.issue.type === "DetailScale") {
    //各地の震度アイコン
    for (let i = 0; i < msg.points.length; i++) {
      switch (msg.points[i].scale) {
        case 10:
          jma_int = "1";
          break;
        case 20:
          jma_int = "2";
          break;
        case 30:
          jma_int = "3";
          break;
        case 40:
          jma_int = "4";
          break;
        case 45:
          jma_int = "5-";
          break;
        case 50:
          jma_int = "5+";
          break;
        case 55:
          jma_int = "6-";
          break;
        case 60:
          jma_int = "6+";
          break;
        case 70:
          jma_int = "7";
          break;
        case 46:
          jma_int = "震度5弱以上未入電";
          break;
      }
      for (let j = 0; j < ShindoObsPoint.length; j++) {
        if (ShindoObsPoint[j].name === msg.points[i].addr) {
          latlon = [ShindoObsPoint[j].lat, ShindoObsPoint[j].lon];
        }
      }
      //マーカーを作成。アイコンは最初に追加した部分から引用
      let add_marker = L.marker(latlon, { pane: "intpane" + jma_int, icon: ICON_LIST[jma_int].icon });

      //マーカークリックで表示されるテキストを設定
      add_marker.bindPopup(`<p>震度${jma_int}：${msg.points[i].addr}</p>`);
      marker_list.addLayer(add_marker);
    };
    marker_list.addTo(map);

    map.fitBounds(marker_list.getBounds());
  }
};