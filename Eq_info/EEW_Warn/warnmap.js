let map;
let epicenter_icon;
let map_data = { pref: {}, region: {} };
let warn_data = {};

$(window).on("load", function () {
  map = L.map("map", {
    zoomControl: true,
    maxZoom: 13,
    minZoom: 4,
    preferCanvas: true,
  });
  map.setView([34.144, 135.527], 5);

  map.zoomControl.setPosition("topright");
  map.createPane("eppane").style.zIndex = 450;
  map.createPane("fill").style.zIndex = 400;
  map.createPane("base").style.zIndex = 300;

  L.tileLayer("//cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "地図データ：<a href='//www.gsi.go.jp/'>国土地理院</a>",
    maxZoom: 13,
    minZoom: 4,
    pane: "base",
  }).addTo(map);

  map.attributionControl.addAttribution("緊急地震速報：<a href='https://iedred7584.dev/'>iedred7584</a>");
  map.attributionControl.addAttribution("<br>緊急地震速報／府県予報区,地震情報／細分区域 ：<a href='https://www.data.jma.go.jp/developer/gis.html'>気象庁</a>※データを加工して作成");
  //https://www.statsilk.com/maps/convert-esri-shapefile-map-geojson-formatを参考にhttps://mapshaper.org/でそれぞれ1%にしてtopojsonに加工

  //震源地アイコンの設定
  epicenter_icon = L.icon({
    iconUrl: "../assets/image/epicenter.png",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  //地図データ取得
  //初回時のみ読み込むため変数にいれる（切替時は変数のデータを使用する）
  //元ファイルは気象庁のページからダウンロード（http://www.data.jma.go.jp/developer/gis.html）緊急地震速報／府県予報区,地震情報／細分区域
  //↑ダウンロードしたファイルの ・・・},"objects":{"○○○":{"type":"GeometryCollection","geometries
  //                                               ↑ここをjapan_eewfにしたりjapan_quakeにする必要がある
  $.when(
    $.getJSON("japan_eewf.json"),
    $.getJSON("../assets/japan_quake.json")
  ).done(function (pdata, qdata) {
    map_data.pref = pdata[0];
    map_data.region = qdata[0];

    eew_get();
  });
});

//緊急地震速報JSON取得
function eew_get() {
  $.getJSON("warnsample.json").done(function (data) {
    if (data.ParseStatus !== "Success" || data.Warn === false || data.WarnForecast === undefined) return;
    //都道府県・地域別でtarget_areaに追加
    let target_area = { pref: [], region: [] };
    data.WarnForecast.LocalAreas.forEach((p) => {
      target_area.pref.push(p);
    });

    data.WarnForecast.Regions.forEach((r) => {
      target_area.region.push(r);
    });

    //震源がプロットされていたらマップから消す
    if (epicenter_plot != undefined) {
      map.removeLayer(epicenter_plot);
      epicenter_plot = undefined;
    }

    epicenter_plot = L.marker([data.Hypocenter.Location.Lat, data.Hypocenter.Location.Long], {
      pane: "eppane",
      icon: epicenter_icon,
    });

    let epcenter = data.WarnForecast.Hypocenter.Name;

    //震源クリックで表示されるテキストを設定
    epicenter_plot.bindPopup(`<p>${epcenter}で地震`, {
      width: "max-content",
    });
    map.addLayer(epicenter_plot);

    warn_data = target_area;
    warnarea_draw("pref");

    public_data = data;
  });
}

//マップに表示
let fill_layer = undefined;
let epicenter_plot = undefined;
function warnarea_draw(type) {
  //すでにfill_layerが使われていたらマップから消去
  if (fill_layer != undefined) {
    map.removeLayer(fill_layer);
  }

  //拡大用に定義
  let bound = L.latLngBounds();

  //表示タイプによってマップデータとjsonキーを変更
  let mgeo = [map_data.pref, map_data.pref.objects.japan_eewf];
  if (type === "region") {
    mgeo = [map_data.region, map_data.region.objects.japan_quake];
  }

  //塗りつぶし
  let fill_geoobje = topojson.feature(mgeo[0], mgeo[1]);
  fill_layer = L.geoJson(fill_geoobje, {
    onEachFeature: function (feature, layer) {
      //警戒対象の場合は拡大対象にする
      let mapname = feature.properties.name;
      let name_index = warn_data[type].indexOf(mapname);
      if (name_index !== -1 && mapname == warn_data[type][name_index]) {
        bound.extend([layer._bounds._northEast, layer._bounds._southWest]);

        if (type === "region") {
          for (let i = 0; i < public_data.Forecast.length; i++) {
            if (warn_data[type][name_index] === public_data.Forecast[i].Intensity.Name) {
              layer.bindPopup("<p>" + warn_data[type][name_index] + "<br>予想震度：" + public_data.Forecast[i].Intensity.Description + "</p>");
            }
          }
        } else {
          layer.bindPopup("<p>" + warn_data[type][name_index] + "<br>強い揺れに警戒</p>");
        }
      }
    },
    style: function (feature) {
      //tareaを参照し、名前が一致する場合は色を変える
      let fill_color = "transparent";
      let mapname = feature.properties.name;
      let name_index = warn_data[type].indexOf(mapname);
      if (name_index !== -1 && mapname == warn_data[type][name_index]) {
        fill_color = "#FF3E3E";
      }

      return {
        fillColor: fill_color,
        fillOpacity: 0.65,
        opacity: 0.85,
        weight: 1,
        color: "#656565",
        pane: "fill",
      };
    },
  }).addTo(map);

  //拡大
  bound.extend(epicenter_plot._latlng);
  map.fitBounds(bound);
}
