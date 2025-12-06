# PV Estimate Service

Mały serwis HTTP oparty o Express z endpointem `POST /api/pv-estimate`, który w tle wywołuje PVGIS PVcalc, zwraca roczną produkcję energii (kWh/rok) oraz szacuje roczną wartość finansową (PLN/rok). Dołączony jest prosty frontend testowy w `public/index.html`.

## Wymagania

- Node.js 18+ (wymagane do wbudowanego `fetch`).

## Uruchomienie

```bash
npm install
npm run dev
```

Serwis nasłuchuje na `http://localhost:3000`. Frontend testowy dostępny pod `http://localhost:3000/`.

## Endpoint

`POST /api/pv-estimate`

Przykładowe body:

```json
{
  "latitude": 50.25,
  "longitude": 22.1,
  "tilt_deg": 35,
  "azimuth_deg": 0,
  "system_size_kwp": 6.0,
  "system_losses_percent": 14.0,
  "energy_price_pln_per_kwh": 0.85,
  "export_price_pln_per_kwh": 0.45,
  "self_consumption_ratio": 0.7,
  "currency": "PLN"
}
```

### Odpowiedź (skrót)

- `pv_output.annual_energy_kwh` – roczna produkcja (kWh/rok) z PVGIS.
- `pv_output.monthly_energy_kwh` – tablica miesięcznych wartości (jeśli zwróci PVGIS).
- `economics.total_value_pln` – roczna wartość finansowa (PLN/rok).

### Walidacja i błędy

- 400: `invalid_input` z listą błędów walidacji.
- 502: `PVGIS service unavailable` jeśli PVGIS nie odpowie lub zwróci niekompletną odpowiedź.

## Zadania do uruchomienia

- `npm run dev` – start serwera w trybie deweloperskim.
- `npm start` – start serwera z `NODE_ENV=production`.

## Notatki

- PVGIS endpoint: `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc`.
- Korzystamy z `zod` do walidacji wejścia i natywnego `fetch` do wywołań HTTP.
