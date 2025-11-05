/**
 * Generate dynamic energy forecast with variance
 * @param {string} target - Performance level: "low", "medium", "high"
 * @returns {Array} 7-day forecast with dynamic irradiation values
 */
export default function generateEnergyForecast(target) {
  // Base ranges for irradiation values in kWh/m2
  let irradiationRange;
  if (target === 'high') {
    // average above 4 - clear skies, excellent conditions
    irradiationRange = { min: 4.5, max: 6.5 };
  } else if (target === 'medium') {
    // average between 2 and 4 - mixed conditions
    irradiationRange = { min: 1.5, max: 4.5 };
  } else if (target === 'low') {
    // average below 2 - cloudy, poor conditions
    irradiationRange = { min: 0, max: 3 };
  }

  const energyForecast = [];

  // generate 7 days of forecast with random variance
  for (let i = 0; i < 7; i++) {
    // set date, irradiation average per day, and push forecast
    const dayForecast = {};
    const date = new Date();
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    date.setDate(date.getDate() + i);
    dayForecast.date = date.toDateString();

    // Generate dynamic irradiation with variance
    const { min, max } = irradiationRange;
    const irradiation = Math.random() * (max - min) + min;
    dayForecast.irradiation = Math.round(irradiation * 10) / 10; // round to 1 decimal

    energyForecast.push(dayForecast);
  }
  return energyForecast;
}
