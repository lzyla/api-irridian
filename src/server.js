import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const inputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tilt_deg: z.number().min(0).max(90),
  azimuth_deg: z.number().min(-180).max(180),
  system_size_kwp: z.number().positive(),
  system_losses_percent: z.number().min(0).max(100),
  energy_price_pln_per_kwh: z.number().nonnegative(),
  export_price_pln_per_kwh: z.number().nonnegative(),
  self_consumption_ratio: z.number().min(0).max(1),
  currency: z.string().min(1),
});

function buildPVGISUrl(params) {
  const baseUrl = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc";
  const url = new URL(baseUrl);
  url.searchParams.set("lat", params.latitude.toString());
  url.searchParams.set("lon", params.longitude.toString());
  url.searchParams.set("peakpower", params.system_size_kwp.toString());
  url.searchParams.set("loss", params.system_losses_percent.toString());
  url.searchParams.set("angle", params.tilt_deg.toString());
  url.searchParams.set("aspect", params.azimuth_deg.toString());
  url.searchParams.set("outputformat", "json");
  return url.toString();
}

async function callPVGIS(params) {
  const url = buildPVGISUrl(params);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PVGIS responded with status ${response.status}`);
  }
  const data = await response.json();
  const annualEnergy =
    data?.outputs?.totals?.fixed?.E_y ??
    data?.outputs?.totals?.E_y ??
    null;
  if (annualEnergy == null) {
    throw new Error("PVGIS response missing annual energy");
  }
  const monthly = Array.isArray(data?.outputs?.monthly)
    ? data.outputs.monthly.map((m) => m?.E_m).filter((v) => typeof v === "number")
    : null;
  return { annualEnergyKwh: annualEnergy, monthlyEnergyKwh: monthly };
}

function calculateEconomics(annualEnergyKwh, prices) {
  const selfKwh = annualEnergyKwh * prices.self_consumption_ratio;
  const exportKwh = annualEnergyKwh * (1 - prices.self_consumption_ratio);
  const valueSelf = selfKwh * prices.energy_price_pln_per_kwh;
  const valueExport = exportKwh * prices.export_price_pln_per_kwh;
  const total = valueSelf + valueExport;
  return {
    self_consumption_kwh: selfKwh,
    export_kwh: exportKwh,
    value_self_pln: valueSelf,
    value_export_pln: valueExport,
    total_value_pln: total,
    currency: prices.currency,
  };
}

app.post("/api/pv-estimate", async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_input",
      details: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const input = parsed.data;

  try {
    const pv = await callPVGIS(input);
    const economics = calculateEconomics(pv.annualEnergyKwh, input);
    const responseBody = {
      input,
      pv_output: {
        annual_energy_kwh: pv.annualEnergyKwh,
        monthly_energy_kwh: pv.monthlyEnergyKwh ?? undefined,
      },
      economics,
      meta: {
        source: "PVGIS v5_2 PVcalc",
        calculation_timestamp: new Date().toISOString(),
      },
    };
    return res.json(responseBody);
  } catch (err) {
    console.error("PVGIS error", err);
    return res.status(502).json({ error: "PVGIS service unavailable" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PV estimate service listening on http://localhost:${PORT}`);
});
