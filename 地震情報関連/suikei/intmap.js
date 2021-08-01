let map;
let epicenter_icon;
let est_intdata = [];

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
  map.createPane("image").style.zIndex = 100;
  map.createPane("eppane").style.zIndex = 150;

  L.tileLayer("//cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "地図データ：<a href='//www.gsi.go.jp/'>国土地理院</a>",
    maxZoom: 13,
    minZoom: 4,
    pane: "base",
  }).addTo(map);

  map.attributionControl.addAttribution("地震情報：<a href='https://www.jma.go.jp/'>気象庁</a>");

  //震源地アイコンの設定
  epicenter_icon = L.icon({
    iconUrl: "../assets/image/epicenter.png",
    iconSize: [25, 25],
    iconAnchor: [12, 12],
  });

  jma_listget();
});

//推計震度分布一覧JSON読み込み
function jma_listget() {
  $.getJSON("//www.jma.go.jp/bosai/estimated_intensity_map/data/list.json?" + new Date().getTime()).done(function (data) {
    console.log(data);
    //訓練データを除外し、データをest_intdataに保存
    for (let i = 0; i < data.length; i++) {
      if (data[i].hypo.kun === 0) {
        let oritime = new Date(data[i].hypo.at);
        let time = oritime.getDate() + "日 " + oritime.getHours() + "時" + oritime.getMinutes() + "分発表";
        $("#est_selecter").append($("<option>").html(`${time}：${data[i].hypo.epi}`).val(i));

        est_intdata.push({ url: data[i].url, mesh: data[i].mesh_num, bound: data[i].bounds, hypocenter: data[i].hypo });
      }
    }

    jma_estimage(0);
  });
}

//推計震度画像表示
let image_layer = [];
let ep_marker;
function jma_estimage(index) {
  if (image_layer.length != 0) {
    image_layer.forEach((layer) => {
      map.removeLayer(layer);
    });
    map.removeLayer(ep_marker);
  }

  est_intdata[index].mesh.forEach((mesh) => {
    //気象庁のコードを引用してます
    let image_url = `//www.jma.go.jp/bosai/estimated_intensity_map/data/${est_intdata[index].url}/${mesh}.png`;
    let swLat = parseInt(mesh.substr(0, 2)) / 1.5;
    let swLon = parseInt(mesh.substr(2, 2)) + 100;
    let neLat = swLat + 40 / 60;
    let neLon = swLon + 1;
    swLat = swLat - 10695e-8 * swLat + 17464e-9 * swLon + 0.0046017;
    swLon = swLon - 46038e-9 * swLat - 83043e-9 * swLon + 0.01004;
    neLat = neLat - 10695e-8 * neLat + 17464e-9 * neLon + 0.0046017;
    neLon = neLon - 46038e-9 * neLat - 83043e-9 * neLon + 0.01004;
    let imageBounds = [
      [swLat, swLon],
      [neLat, neLon],
    ];
    let ilayer = L.imageOverlay(image_url, imageBounds, { pane: "image" }).addTo(map);
    image_layer.push(ilayer);
  });

  //震源地追加
  ep_marker = L.marker([est_intdata[index].hypocenter.lat, est_intdata[index].hypocenter.lon], {
    pane: "eppane",
    icon: epicenter_icon,
  });

  let depth = est_intdata[index].hypocenter.dep;
  let depth_s = depth.toString() + "km";
  if (depth_s === "0") {
    depth_s = "ごく浅い";
  }

  let epcenter = est_intdata[index].hypocenter.epi;
  let magnitude = est_intdata[index].hypocenter.mag;

  //震源クリックで表示されるテキストを設定
  ep_marker.bindPopup(`<p>震源地：${epcenter}<br>深さ：${depth_s}<br>マグニチュード${magnitude}</p>`, {
    width: "max-content",
  });
  ep_marker.addTo(map);

  //マーカーにあわせて拡大
  map.fitBounds(est_intdata[index].bound);
}