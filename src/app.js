const express = require("express");
const path = require("path");
const chalk = require("chalk");
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