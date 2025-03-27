import client from '../../db/sharedConnection.js';
import { faker } from '@faker-js/faker';

class WeatherService {
  #zip;
  #country;

  constructor(zip, country) {
    this.#zip = zip;
    this.#country = country;
  }

  async getWeather() {
    // attempt to get weather
    const { rows } = await client.query(
      `SELECT temperature, description, updated_at
        FROM weather
        WHERE zip = $1 AND country = $2
      `,
      [this.#zip, this.#country]
    );
    const weatherRows = rows;
    // if weather exists and not stale, then return
    const isStale = this.#weatherIsStale(weatherRows[0]?.updated_at);
    if (weatherRows.length > 0 && !isStale) {
      return weatherRows;
    }
    // non-existent weather or stale weather; generate
    const weather = await this.#generateWeather();
    return weather;
  }

  /**
   * Helper function to update the weather.
   * Currently generates fake weather, until an actual service
   *  is to be used.
   */
  async #generateWeather() {
    console.log('run generate weather');
    const temperature = faker.number.int({
      min: 32,
      max: 86,
    });
    const descriptionIndex = faker.number.int({
      min: 0,
      max: 2,
    });
    const descriptions = ['cloudy', 'overcast', 'clear skies'];
    const description = descriptions[descriptionIndex];
    const { rows } = await client.query(
      `
      INSERT INTO weather (zip, country, temperature, description) VALUES ($1, $2, $3, $4)
      ON CONFLICT (zip, country) DO UPDATE
      SET (temperature, description, updated_at) = ($3, $4, now())
      RETURNING temperature, description
    `,
      [this.#zip, this.#country, temperature, description]
    );
    return rows;
  }

  /**
   * Helper to check if weather data is stale.
   * Weather data is considered stale if it was generated the previous calendar day.
   * @param {*} date
   * @returns true if stale, false if not stale
   */
  #weatherIsStale(date) {
    if (!date) return true;

    const cutoffDate = new Date(Date.now());
    cutoffDate.setHours(0);
    cutoffDate.setMinutes(0);
    cutoffDate.setSeconds(0);
    cutoffDate.setMilliseconds(0);
    cutoffDate.setDate(cutoffDate.getDate() - 1);

    if (date < cutoffDate) {
      return true;
    }
    return false;
  }
}

export default WeatherService;
