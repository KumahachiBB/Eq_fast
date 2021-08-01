let map;
let epicenter_icon;
//塗りつぶしの色設定
const INT_COLOR = {
  "1": "#99ffff",
  "2": "#3399ff",
  "3": "#00ff00",
  "4": "#ffff33",
  "5-": "#ffbb00",
  "5+": "#ff9600",
  "6-": "#ffbbff",
  "6+": "#ff2f00",
  "7": "#960096",
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
  map.createPane("eppane").style.zIndex = 450;
  map.createPane("fill").style.zIndex = 400;
  map.createPane("base").style.zIndex = 300;

  L.tileLayer("//cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "地図データ：<a href='//www.gsi.go.jp/'>国土地理院</a>",
    maxZoom: 13,
    minZoom: 4,
    pane: "base",
  }).addTo(map);

  map.attributionControl.addAttribution("地震情報：<a href='https://www.jma.go.jp/'>気象庁</a>,<br> 地震情報／細分区域：<a href='https://www.data.jma.go.jp/developer/gis.html'>気象庁</a>※データを加工して作成");

  //震源地アイコンの設定
  epicenter_icon = L.icon({
    iconUrl: "../assets/image/epicenter.png",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  jma_listget();
});

//地震情報一覧JSON読み込み
function jma_listget() {
  $.getJSON("//www.jma.go.jp/bosai/quake/data/list.json?" + new Date().getTime())
    .done(function (data) {
      //latest_urlが空のときのみ最新の地震JSONのURLをいれて、それ以外はselectに追加（遠地地震などの情報は除外）
      //「data[i].ift === "発表" &&」を消すと訓練データも表示されます（扱い注意）
      let latest_url = "";
      for (let i = 0; i < data.length; i++) {
        if (
          data[i].ift === "発表" &&
          data[i].ttl !== "震源に関する情報" &&
          data[i].ttl.includes("南海トラフ") === false &&
          data[i].ttl !== "顕著な地震の震源要素更新のお知らせ" &&
          data[i].ttl !== "地震回数に関する情報" &&
          data[i].ttl !== "遠地地震に関する情報"
        ) {
          let oritime = new Date(data[i].at);
          let time = oritime.getDate() + "日 " + oritime.getHours() + "時" + oritime.getMinutes() + "分";
          let ep = data[i].anm;
          if (ep === "") ep = "震度速報";

          $("#quake_selecter").append($("<option>").html(`${time}：${ep}／震度${data[i].maxi}`).val(data[i].json));
          if (latest_url !== "") continue;
          latest_url = data[i].json;
        }
      }

      jma_quakeget(latest_url);
    });
}

//メインのJSON取得&プロット
let fill_layer = undefined;
let epicenter_plot = undefined;
function jma_quakeget(url) {
  //すでにfill_layerが使われていたらマップから消去
  if (fill_layer != undefined) {
    map.removeLayer(fill_layer);
  }

  //震源がプロットされていたらマップから消す
  if (epicenter_plot != undefined) {
    map.removeLayer(epicenter_plot);
    epicenter_plot = undefined;
  }

  //地震メインのJSONと地図データ（塗りつぶし）を一緒に読み込む
  //データ切替時に毎回地図データも読み込むのであんまり良いコードではない
  $.when(
    $.getJSON("//www.jma.go.jp/bosai/quake/data/" + url),
    $.getJSON("../assets/japan_quake.json")
  ).done(function (qdata, mdata) {
    let fill_data = [];
    console.log(qdata);
    //細分区域データがあるところまで潜っていく（都道府県データ→細分区域データ）
    qdata[0].Body.Intensity.Observation.Pref.forEach((pref_data) => {
      pref_data.Area.forEach((area_data) => {
        //データをまとめてfill_dataに追加
        let add_obj = {
          code: area_data.Code,
          name: area_data.Name,
          int: area_data.MaxInt,
        };
        fill_data.push(add_obj);
      });
    });

    //拡大用に定義
    let bound = L.latLngBounds();

    //塗りつぶし
    let fill_geoobje = topojson.feature(mdata[0], mdata[0].objects.japan_quake);
    fill_layer = L.geoJson(fill_geoobje, {
      onEachFeature: function (feature, layer) {
        //震度データがある部分のみ拡大対象にする
        let mapcode = feature.properties.code;
        let code_index = fill_data.findIndex(({ code }) => code === mapcode);
        if (code_index !== -1 && mapcode == fill_data[code_index].code) {
          bound.extend([layer._bounds._northEast, layer._bounds._southWest]);

          //ポップアップ設定
          layer.bindPopup("<p>震度" + fill_data[code_index].int + "： " + fill_data[code_index].name + "</p>");
        }
      },
      style: function (feature) {
        //fill_dataを参照し、地図コードが一致する場合は震度からINT_COLORを参照する
        let fill_color = "transparent";
        let mapcode = feature.properties.code;
        let code_index = fill_data.findIndex(({ code }) => code === mapcode);
        if (code_index !== -1 && mapcode == fill_data[code_index].code) {
          fill_color = INT_COLOR[fill_data[code_index].int];
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

    //震源地追加（震度速報時はデータが存在しないため省略）
    if (qdata[0].Body.Earthquake != undefined) {
      let ep_base = qdata[0].Body.Earthquake.Hypocenter.Area.Coordinate;
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
      let epcenter = qdata[0].Body.Earthquake.Hypocenter.Area.Name;
      let magnitude = qdata[0].Body.Earthquake.Magnitude;

      //震源クリックで表示されるテキストを設定
      epicenter_plot.bindPopup(`<p>震源地：${epcenter}<br>深さ：${depth}<br>マグニチュード${magnitude}</p>`, {
        width: "max-content",
      });

      //マップにプロット&ズーム調整
      map.addLayer(epicenter_plot);
      bound.extend(epicenter_plot._latlng);
    }

    //塗りつぶし・震源にあわせて拡大
    map.fitBounds(bound);
  });
}