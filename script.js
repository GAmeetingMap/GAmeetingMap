// script.js

// Google Sheets APIキーとスプレッドシートIDを設定
const apiKey = atob("QUl6YVN5Q0JvZDhKUDQ2Z0R6X2NWT1U5MXhRbmVVajBhbzlPUHk0");
const sheetId = atob("MTAwRTFTQTd4Z1M2dTM3a1AzYXZQY0V2eS1iNnllTjVHWDk2aVdhakZBNTQ=");
const range = atob("RXZlbnRWZW51ZUluZm8=");

const map = L.map('map', {
    maxBounds: [
        [10.0, 120.0], // 南西端
        [55.0, 155.0]  // 北東端
    ],
    maxBoundsViscosity: 1.0, // 制限エリアに近づくほどスクロールを抑制
    minZoom: 5, // 最小ズームレベル
    maxZoom: 18 // 最大ズームレベル
}).setView([35.681236, 139.767125], 5); // 初期位置は東京

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const locationListDiv = document.getElementById('location-list');
const venueCountDiv = document.getElementById('venue-count');
const locateButton = document.getElementById('reLocate');
const spinner = document.getElementById('spinner'); // スピナー要素

let markers = [];
let userMarker = null;
let locations = []; // グローバル変数としてlocationsを宣言

// Google Sheets APIからデータを取得する関数
const fetchDataFromGoogleSheets = async () => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('API エラー:', data.error);
            throw new Error('Google Sheets API エラー');
        }

        if (data.values) {
            return data.values.slice(1); // 最初の行はヘッダーなので、それ以外を返す
        } else {
            throw new Error('データが空です');
        }
    } catch (error) {
        console.error("データ取得エラー:", error);
        return [];
    }
};

const updateMapWithPins = (locations) => {
    const venueGroups = {};

    // 会場名ごとにデータをグループ化
    locations.forEach(([date, venue, time, url, address, lat, lng]) => {
        if (!venueGroups[venue]) {
            venueGroups[venue] = { address, lat, lng, events: [] };
        }
        venueGroups[venue].events.push({ date, time, url });
    });

    console.log(venueGroups);  // venueGroupsの内容を確認

    // 各会場に対してピンを作成
    Object.entries(venueGroups).forEach(([venue, data]) => {
        const latitude = parseFloat(data.lat);
        const longitude = parseFloat(data.lng);

        if (!isNaN(latitude) && !isNaN(longitude)) {
            const marker = L.marker([latitude, longitude]).addTo(map);

            // ポップアップの内容を作成
            const popupContent = `
                <strong>${venue}</strong><br>
                ${data.address}<br>
                <ul>
                    ${data.events.map(event =>
                        `<li>${event.date} ${event.time} <a href="${event.url}" target="_blank">詳細</a></li>`
                    ).join('')}
                </ul>
            `;
            marker.bindPopup(popupContent);

            marker.on('click', () => {
                map.setView([latitude, longitude], 16, {
                    animate: true,
                    duration: 0.5
                });
            });

            markers.push(marker);
        }
    });
};


// 会場情報のリストを更新する関数（距離順に並べる）
const updateLocationList = (locations, userLat, userLng) => {
    const venueGroups = {};

    // 会場名ごとにデータをグループ化
    locations.forEach(([date, venue, time, url, address, lat, lng]) => {
        if (!venueGroups[venue]) {
            venueGroups[venue] = { address, lat, lng, events: [] };
        }
        venueGroups[venue].events.push({ date, time, url });
    });

    // 距離を計算してソート
    const sortedVenues = Object.entries(venueGroups).map(([venue, data]) => {
        const latitude = parseFloat(data.lat);
        const longitude = parseFloat(data.lng);

        if (!isNaN(latitude) && !isNaN(longitude)) {
            const distance = getDistance(userLat, userLng, latitude, longitude);
            return { venue, address: data.address, distance, events: data.events, latitude, longitude };
        }
        return null;
    }).filter(Boolean);

    sortedVenues.sort((a, b) => a.distance - b.distance);

    // リストを更新
    locationListDiv.innerHTML = '';
    sortedVenues.forEach(({ venue, address, distance, events, latitude, longitude }) => {
        const listItem = document.createElement('div');
        listItem.classList.add('location-item');
        listItem.innerHTML = `
            <strong>${venue}</strong>（${distance.toFixed(1)} km）<br>
            ${address}<br>
            <ul>
                ${events.map(event =>
                    `<li>${event.date} ${event.time} <a href="${event.url}" target="_blank">詳細</a></li>`
                ).join('')}
            </ul>
        `;

        
// 1秒待機する関数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// リストアイテムがクリックされた時
listItem.addEventListener('click', async () => {
    // 地図の位置が表示されるように、ページをスクロール
    const mapElement = document.getElementById('map');
    const mapOffsetTop = mapElement.offsetTop; // 地図までのオフセット

    // ページをスクロール（アニメーション）
    window.scrollTo({
        top: mapOffsetTop - 50,  // 地図が画面中央に来るように調整（50pxの余白を加える）
        behavior: 'smooth'       // スムーズにスクロール
    });

    // スクロール後、1秒待機
    await sleep(1000); // 1秒待つ

    // クリックされたリストアイテムに対応する緯度経度を取得
    const pinLatLng = [latitude, longitude]; // クリックされたリストに対応する緯度経度

    // 地図のビューをその位置に移動（ズーム16）
    map.setView(pinLatLng, 16, { animate: true });

    // 1秒後にポップアップを表示
    await sleep(500); // ビューが更新されるまで待機

    // ピンを移動した後、そのピンに紐づくポップアップを開く
    const marker = L.marker(pinLatLng).addTo(map); // すでに地図に追加されているピンを利用
    marker.bindPopup(`
        <strong>${venue}</strong><br>
        ${address}<br>
        <ul>
            ${events.map(event =>
                `<li>${event.date} ${event.time} <a href="${event.url}" target="_blank">詳細</a></li>`
            ).join('')}
        </ul>
    `).openPopup(); // ポップアップを表示
});



locationListDiv.appendChild(listItem);
    });

    venueCountDiv.textContent = `会場数: ${sortedVenues.length}`;
};

// 2地点間の距離を計算する関数（キロメートル単位）
const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// 現在地の取得
const getUserLocation = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            // ユーザーの位置にピンを立てる
            if (userMarker) {
                userMarker.setLatLng([userLat, userLng]);
            } else {
                userMarker = L.marker([userLat, userLng]).addTo(map);
                userMarker.bindPopup('現在地').openPopup();
            }

            map.setView([userLat, userLng], 16); // ズーム16に設定

            updateLocationList(locations, userLat, userLng); // 会場情報を更新

            spinner.style.display = 'none'; // スピナーを非表示
        }, () => {
            alert("位置情報の取得に失敗しました");
            spinner.style.display = 'none'; // スピナーを非表示
        });
    } else {
        alert("このブラウザでは位置情報がサポートされていません");
        spinner.style.display = 'none'; // スピナーを非表示
    }
};

// ページが読み込まれたときに実行
window.onload = () => {
    spinner.style.display = 'block'; // スピナーを表示
    fetchDataFromGoogleSheets().then(fetchedLocations => {
        locations = fetchedLocations;
        updateMapWithPins(locations); // ピンを更新
        getUserLocation(); // 現在地を取得
    });
};

// 現在地ボタンのクリックイベント
locateButton.addEventListener('click', () => {
    spinner.style.display = 'block'; // スピナーを表示
    fetchDataFromGoogleSheets().then(fetchedLocations => {
        locations = fetchedLocations;
        updateMapWithPins(locations); // ピンを更新
        getUserLocation(); // 現在地を取得
    });
});

// 右クリックを無効にする
//document.addEventListener("contextmenu", function (event) {
//    event.preventDefault();  // 右クリックメニューを無効化
//});

// 現在の年月を取得して表示する
const currentDateElement = document.getElementById('current-date');
const today = new Date();
const year = today.getFullYear();
const month = today.getMonth() + 1; // getMonth()は0から始まるので+1
currentDateElement.textContent = `（${year}年${month}月）`;
