const express = require("express");
const path = require("path");
const chalk = require("chalk");
const logins = require("./logins.json");

function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * 
 * @param {import("logerian").Logger} logger 
 * @returns {import("express").Express}
 */
module.exports.getApp = function getApp(logger) {
  const app = express();
  app.disable("x-powered-by");
  if (typeof process.env.TRUST_PROXY === "undefined") {
    app.set("trust proxy", false);
  } else if (!Number.isNaN(Number(process.env.TRUST_PROXY))) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY));
  } else if (["true", "false"].includes(process.env.TRUST_PROXY)) {
    app.set("trust proxy", Boolean(process.env.TRUST_PROXY));
  } else {
    app.set("trust proxy", process.env.TRUST_PROXY);
  }

  app.use((req, res, next) => {
    const startedAt = process.hrtime();

    res.on("finish", () => {
      if (/^\/(js|css)/.test(req.url) && res.statusCode < 400) {
        return;
      }

      const color =
        res.statusCode >= 500
          ? "red"
          : res.statusCode >= 400
          ? "yellow"
          : res.statusCode >= 300
          ? "cyan"
          : res.statusCode >= 200
          ? "green"
          : "white";

      const elapsed = process.hrtime(startedAt);
      const elapsedMs = elapsed[0] * 1e3 + elapsed[1] / 1e6;
      logger.debug(
        chalk`\t${(req.ip ?? "unknown ip").padEnd(
          15,
          " "
        )} - ${req.method.padEnd(4, " ")} ${req.originalUrl} {${color} ${
          res.statusCode
        }} ${elapsedMs.toFixed(3)}ms`
      );
    });

    return next();
  });
  
  /** @type {Map<string, [string, number]>} */
  const loginEndpoints = new Map();

  app.get("/getLoginEndpoint/:username", async (req, res, next) => {
    const username = req.params.username;
    if (logins.find(({ username: u }) => username === u)) {
      let loginEndpoint;
      while (loginEndpoints.has((loginEndpoint = makeid(64))));
      const timeout = Date.now() + 3000;
      res.status(200);
      res.json({
        endpointId: loginEndpoint,
        timeout,
      });
      loginEndpoints.set(loginEndpoint, [username, timeout]);
      setTimeout(() => {
        loginEndpoints.delete(loginEndpoint);
      }, 3500);
    } else {
      return next();
    }
  });

  app.get("/login/:id", async (req, res, next) => {
    const loginEndpoint = req.params.id;
    if (loginEndpoints.has(loginEndpoint)) {
      const [username, timeout] = loginEndpoints.get(loginEndpoint);
      const password = logins.find(({username: u}) => u === username).password;
      if (timeout < Date.now()) {
        return next();
      }
      if (password) {
        res.status(200);
        res.json({ password });
        res.end();
      } else {
        return next();
      }
    } else {
      return next();
    }
  });

  app.use(
    express.static(path.join(__dirname, "../public"), {
      extensions: ["html"],
    })
  );

  // Error handling
  app.use((err, _req, res, _next) => {
    res.status(500);
    logger.error(err);
    if (process.env.NODE_ENV === "development") {
      if (err instanceof Error) {
        res.json({
          errors: [
            {
              message: err.message,
              stack: err.stack,
              name: err.name,
            },
          ],
        });
      } else {
        res.json({
          errors: [
            {
              message:
                "An unknown error occurred. See the logs for more information.",
            },
          ],
        });
      }
    } else {
      res.json({
        errors: ["An unexpected error occurred."],
      });
    }
  });

  return app;
}