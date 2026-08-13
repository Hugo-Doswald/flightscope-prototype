use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Default)]
struct LiveCache {
    fetched_at: Option<Instant>,
    response: Option<Value>,
}

static LIVE_CACHE: OnceLock<Mutex<LiveCache>> = OnceLock::new();

fn live_cache() -> &'static Mutex<LiveCache> {
    LIVE_CACHE.get_or_init(|| Mutex::new(LiveCache::default()))
}

fn value_f64(row: &[Value], index: usize) -> Option<f64> {
    row.get(index)?.as_f64()
}

fn value_string(row: &[Value], index: usize) -> String {
    row.get(index)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

#[tauri::command]
async fn fetch_live_aircraft(lat: f64, lon: f64, radius: u16) -> Result<Value, String> {
    {
        let cache = live_cache().lock().map_err(|_| "Live cache lock failed".to_string())?;
        if let (Some(at), Some(response)) = (cache.fetched_at, cache.response.as_ref()) {
            if at.elapsed() < Duration::from_secs(60) {
                let mut cached = response.clone();
                if let Some(obj) = cached.as_object_mut() {
                    obj.insert("cached".into(), Value::Bool(true));
                }
                return Ok(cached);
            }
        }
    }

    let radius = radius.clamp(5, 250) as f64;
    let lat_delta = radius / 60.0;
    let lon_scale = lat.to_radians().cos().abs().max(0.2);
    let lon_delta = radius / (60.0 * lon_scale);

    let lamin = (lat - lat_delta).max(-90.0);
    let lamax = (lat + lat_delta).min(90.0);
    let lomin = (lon - lon_delta).max(-180.0);
    let lomax = (lon + lon_delta).min(180.0);

    let url = format!(
        "https://opensky-network.org/api/states/all?lamin={:.5}&lomin={:.5}&lamax={:.5}&lomax={:.5}",
        lamin, lomin, lamax, lomax
    );

    let client = reqwest::Client::builder()
        .user_agent("FlightScope/0.2.5 non-commercial prototype")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("OpenSky request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let cached = live_cache().lock().ok().and_then(|c| c.response.clone());
        if let Some(mut fallback) = cached {
            if let Some(obj) = fallback.as_object_mut() {
                obj.insert("cached".into(), Value::Bool(true));
                obj.insert(
                    "message".into(),
                    Value::String(format!("OpenSky returned HTTP {status}; showing last live snapshot.")),
                );
            }
            return Ok(fallback);
        }
        return Err(format!("OpenSky service error: HTTP {status}"));
    }

    let raw: Value = response
        .json()
        .await
        .map_err(|e| format!("OpenSky response could not be decoded: {e}"))?;

    let mut ac = Vec::new();
    if let Some(states) = raw.get("states").and_then(Value::as_array) {
        for state in states {
            let Some(row) = state.as_array() else { continue };
            let Some(longitude) = value_f64(row, 5) else { continue };
            let Some(latitude) = value_f64(row, 6) else { continue };

            let hex = value_string(row, 0);
            if hex.is_empty() {
                continue;
            }

            let callsign = value_string(row, 1);
            let altitude_m = value_f64(row, 7).or_else(|| value_f64(row, 13)).unwrap_or(0.0);
            let velocity_ms = value_f64(row, 9).unwrap_or(0.0);
            let track = value_f64(row, 10).unwrap_or(0.0);
            let vertical_ms = value_f64(row, 11).unwrap_or(0.0);
            let squawk = value_string(row, 14);

            ac.push(json!({
                "hex": hex,
                "flight": callsign,
                "lat": latitude,
                "lon": longitude,
                "alt_baro": altitude_m * 3.280839895,
                "gs": velocity_ms * 1.943844492,
                "track": track,
                "baro_rate": vertical_ms * 196.850394,
                "squawk": squawk,
                "r": "",
                "t": "----",
                "desc": "OpenSky live aircraft",
                "ownOp": "",
                "from": "--",
                "to": "--",
                "source": "OpenSky"
            }));
        }
    }

    let result = json!({
        "provider": "OpenSky",
        "cached": false,
        "time": raw.get("time").cloned().unwrap_or(Value::Null),
        "ac": ac
    });

    if let Ok(mut cache) = live_cache().lock() {
        cache.fetched_at = Some(Instant::now());
        cache.response = Some(result.clone());
    }

    Ok(result)
}

#[derive(Debug, Deserialize, Clone)]
struct EnrichmentRequest {
    hex: String,
    callsign: String,
}

#[derive(Debug, Serialize)]
struct EnrichmentResult {
    hex: String,
    callsign: String,
    registration: String,
    type_code: String,
    type_name: String,
    operator: String,
    from: String,
    to: String,
}

async fn json_or_none(client: &reqwest::Client, url: String) -> Option<Value> {
    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.json::<Value>().await.ok()
}

async fn enrich_one(client: reqwest::Client, item: EnrichmentRequest) -> EnrichmentResult {
    let hex = item.hex.trim().to_lowercase();
    let callsign = item.callsign.trim().to_uppercase();

    let aircraft_url = format!("https://hexdb.io/api/v1/aircraft/{hex}");
    let route_url = if callsign.is_empty() {
        None
    } else {
        Some(format!("https://hexdb.io/api/v1/route/icao/{callsign}"))
    };

    let aircraft_future = json_or_none(&client, aircraft_url);
    let route_future = async {
        match route_url {
            Some(url) => json_or_none(&client, url).await,
            None => None,
        }
    };

    let (aircraft_info, route_info) = futures::join!(aircraft_future, route_future);

    let registration = aircraft_info.as_ref()
        .and_then(|v| v.get("Registration"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let type_code = aircraft_info.as_ref()
        .and_then(|v| v.get("ICAOTypeCode"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let type_name = aircraft_info.as_ref()
        .and_then(|v| v.get("Type"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let operator = aircraft_info.as_ref()
        .and_then(|v| v.get("RegisteredOwners"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let route = route_info.as_ref()
        .and_then(|v| v.get("route"))
        .and_then(Value::as_str)
        .unwrap_or("");

    let mut from = String::new();
    let mut to = String::new();

    if let Some((origin_icao, dest_icao)) = route.split_once('-') {
        let origin_url = format!("https://hexdb.io/api/v1/airport/icao/{}", origin_icao.trim());
        let dest_url = format!("https://hexdb.io/api/v1/airport/icao/{}", dest_icao.trim());
        let (origin, dest) = futures::join!(
            json_or_none(&client, origin_url),
            json_or_none(&client, dest_url)
        );

        from = origin.as_ref()
            .and_then(|v| v.get("iata"))
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .unwrap_or(origin_icao.trim())
            .to_string();

        to = dest.as_ref()
            .and_then(|v| v.get("iata"))
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .unwrap_or(dest_icao.trim())
            .to_string();
    }

    EnrichmentResult {
        hex,
        callsign,
        registration,
        type_code,
        type_name,
        operator,
        from,
        to,
    }
}

#[tauri::command]
async fn enrich_aircraft_batch(items: Vec<EnrichmentRequest>) -> Result<Vec<EnrichmentResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("FlightScope/0.2.5 non-commercial prototype")
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let results = stream::iter(items.into_iter().take(40))
        .map(|item| {
            let client = client.clone();
            async move { enrich_one(client, item).await }
        })
        .buffer_unordered(8)
        .collect::<Vec<_>>()
        .await;

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![fetch_live_aircraft, enrich_aircraft_batch])
        .run(tauri::generate_context!())
        .expect("error while running FlightScope");
}
