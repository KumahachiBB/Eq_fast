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

$(window).on("load", function () {
  map = L.map("map", {
    zoomControl: true,
    maxZoom: 13,
    minZoom: 4,
    preferCanvas: true,
  });
  map.setView([34.144, 135.527], 5);

  map.zoomControl.setPosition("topright");
  map.createPane("base").style.zIndex = 40;
  map.createPane("eppane").style.zIndex = 450;
  //震源地アイコンの設定
  epicenter_icon = L.icon({
    iconUrl: "../assets/image/epicenter.png",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  L.tileLayer("//cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "地図データ：<a href='//www.gsi.go.jp/'>国土地理院</a>",
    maxZoom: 13,
    minZoom: 4,
    pane: "base",
  }).addTo(map);

  map.attributionControl.addAttribution("地震情報：<a href='https://www.jma.go.jp/'>気象庁</a>");

  //アイコン追加処理
  let icon_key = Object.keys(ICON_LIST);
  for (let i = 0; i < icon_key.length; i++) {
    ICON_LIST[icon_key[i]].icon = L.icon({
      iconUrl: ICON_LIST[icon_key[i]].url,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    map.createPane("intpane" + icon_key[i]).style.zIndex = ICON_LIST[icon_key[i]].zindex;
  }

  jma_listget();
});

//地震情報一覧JSON読み込み
function jma_listget() {
  $.getJSON("//www.jma.go.jp/bosai/quake/data/list.json?" + new Date().getTime())
    .done(function (data) {
      console.log(data);
      //各地の震度が見つかるまでループ
      let latest_url = "";
      for (let i = 0; i < data.length; i++) {
        if (data[i].ift === "発表" && data[i].ttl === "震源・震度情報") {
          let oritime = new Date(data[i].at);
          let time = oritime.getDate() + "日 " + oritime.getHours() + "時" + oritime.getMinutes() + "分";
          $("#quake_selecter").append(
            $("<option>").html(`${time}：${data[i].anm}／震度${data[i].maxi}`).val(data[i].json)
          );
          if (latest_url !== "") continue;
          latest_url = data[i].json;
        }
      }

      if (latest_url === "") {
        alert("各地の震度データがみつかりませんでした。");
        return;
      }

      jma_quakeget(latest_url);
    });
}

//メインのJSON取得&プロット
let marker_list = undefined;
function jma_quakeget(url) {
  if (marker_list !== undefined) {
    map.removeLayer(marker_list);
  }

  $.getJSON("//www.jma.go.jp/bosai/quake/data/" + url)
    .done(function (data) {
      console.log(data);
      marker_list = L.featureGroup();
      //観測点データがあるところまで潜っていく（都道府県データ→細分区域データ→市町村データ→観測点データ）
      data.Body.Intensity.Observation.Pref.forEach((pref_data) => {
        pref_data.Area.forEach((area_data) => {
          area_data.City.forEach((city_data) => {
            city_data.IntensityStation.forEach((station_data) => {
              //マーカーを作成。アイコンは最初に追加した部分から引用
              let add_maker = L.marker(station_data.latlon, { pane: "intpane" + station_data.Int, icon: ICON_LIST[station_data.Int].icon });

              //マーカークリックで表示されるテキストを設定
              add_maker.bindPopup(`<p>震度${station_data.Int}：${station_data.Name}</p>`, {
                width: "max-content",
              });

              //マーカーをリストに追加
              marker_list.addLayer(add_maker);
            });
          });
        });
      });

      //震源地追加（震度速報時はデータが存在しないため省略）
      if (data.Body.Earthquake != undefined) {
        let ep_base = data.Body.Earthquake.Hypocenter.Area.Coordinate;
        let ep_latlon_s = ep_base.slice(0, 11);
        let ep_latlon = ep_latlon_s.split("+");
        epicenter_plot = L.marker([parseFloat(ep_latlon[1]), parseFloat(ep_latlon[2])], {
          pane: "eppane",
          icon: epicenter_icon,
        });

        let depth_s = ep_base.slice(11);
        depth_s = depth_s.replace("/", "");
        let depth = Math.abs(depth_s / 1000).toString() + "km";
        if (depth_s === "+0") {
          depth = "ごく浅い";
        } else if (depth_s === "" || ep_base === "") {
          depth = "不明";
        } else if (depth_s === "-700000") {
          depth = "700km以上";
        }
        let epcenter = data.Body.Earthquake.Hypocenter.Area.Name;
        let magnitude = data.Body.Earthquake.Magnitude;

        //震源クリックで表示されるテキストを設定
        epicenter_plot.bindPopup(`<p>震源地：${epcenter}<br>深さ：${depth}<br>マグニチュード${magnitude}</p>`, {
          width: "max-content",
        });
        //マップにプロット&ズーム調整
        marker_list.addLayer(epicenter_plot);
      }
      //プロット
      marker_list.addTo(map);
      //マーカーにあわせて拡大
      map.fitBounds(marker_list.getBounds());
    });
}