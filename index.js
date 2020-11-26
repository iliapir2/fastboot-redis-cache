"use strict";

const redis = require("redis");

const FIVE_MINUTES = 5 * 60;

class RedisCache {
  constructor(options) {
    const client = (this.client = redis.createClient({
      host: options.host,
      port: options.port,
    }));

    this.expiration = options.expiration || FIVE_MINUTES;
    this.connected = false;
    this.cacheKey =
      typeof options.cacheKey === "function"
        ? options.cacheKey
        : (path) => path;

    client.on("error", (error) => {
      this.ui.writeLine(`redis error; err=${error}`);
    });

    this.client.on("connect", () => {
      this.connected = true;
      this.ui.writeLine("redis connected");
    });

    this.client.on("end", () => {
      this.connected = false;
      this.ui.writeLine("redis disconnected");
    });
  }

  fetch(path, request) {
    if (!this.connected) {
      return new Promise((res, rej) => rej());
    }

    const key = this.cacheKey(path, request);

    return new Promise((res, rej) => {
      this.client.get(key, (err, reply) => {
        if (err) {
          rej(err);
        } else {
          res(reply);
        }
      });
    });
  }

  put(path, body, response) {
    if (!this.connected) {
      return new Promise((res, rej) => rej());
    }

    const request = response && response.req;
    const key = this.cacheKey(path, request);

    return new Promise((res, rej) => {
      const statusCode = response && response.statusCode;
      const statusCodeStr = statusCode && statusCode + "";

      if (
        statusCodeStr &&
        statusCodeStr.length &&
        (statusCodeStr.charAt(0) === "4" ||
          statusCodeStr.charAt(0) === "5" ||
          statusCodeStr.charAt(0) === "3")
      ) {
        res();
        return;
      }

      this.client
        .multi()
        .set(key, body)
        .expire(path, this.expiration)
        .exec((err) => {
          if (err) {
            rej(err);
          } else {
            res();
          }
        });
    });
  }
}

module.exports = RedisCache;
