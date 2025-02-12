/**
 *
 * @param {*} target string enum; "low", "medium", "high"
 */
export default function generateEnergyForecast(target) {
  // irradiation values based on target in kWh/m2, static for demo
  let irradiationValues;
  if (target === 'high') {
    // average above 4
    irradiationValues = [6, 6, 6, 3, 2, 6, 6];
  } else if (target === 'medium') {
    // average between 2 and 4
    irradiationValues = [6, 0, 0, 1, 3, 3, 4];
  } else if (target === 'low') {
    // average below 2
    irradiationValues = [3, 0, 3, 0, 0, 0, 3];
  }

  const energyForecast = [];

  // generate 7 days of forecast
  for (let i = 0; i < 7; i++) {
    // set date, irradiation average per day, and push forecast
    const dayForecast = {};
    const date = new Date();
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    date.setDate(date.getDate() + i);
    dayForecast.date = date.toDateString();

    dayForecast.irradiation = irradiationValues[i];

    energyForecast.push(dayForecast);
  }
  return energyForecast;
}
