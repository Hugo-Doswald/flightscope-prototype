use serde_json::Value;

#[tauri::command]
async fn fetch_live_aircraft(lat: f64, lon: f64, radius: u16) -> Result<Value, String> {
    let radius = radius.clamp(1, 250);
    let url = format!("https://api.airplanes.live/v2/point/{:.5}/{:.5}/{}", lat, lon, radius);
    let client = reqwest::Client::builder()
        .user_agent("FlightScope/0.2.2 non-commercial prototype")
        .build().map_err(|e| e.to_string())?;
    client.get(url).send().await
        .map_err(|e| format!("ADS-B request failed: {e}"))?
        .error_for_status().map_err(|e| format!("ADS-B service error: {e}"))?
        .json::<Value>().await.map_err(|e| format!("ADS-B decode failed: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![fetch_live_aircraft])
        .run(tauri::generate_context!())
        .expect("error while running FlightScope");
}
