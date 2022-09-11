const path = require("path");
const fs = require("fs-extra");
const express = require("express");
const http = require("http");
const { LoggerLevel, Logger, getLoggerLevelName, coloredLog } = require("logerian");
const { getApp } = require("./app");
const chalk = require("chalk");

void async function main() {

  const logfile = path.join(
    __dirname,
    `../../log/${new Date().toISOString().replace(/[*:?<>|/\\"]/gi, "-")}.txt`
  );
  await fs.ensureFile(logfile);

  const logger = new Logger({
    streams: [
      {
        level: LoggerLevel.DEBUG,
        stream: process.stdout,
        prefix: coloredLog,
      },
      {
        level: LoggerLevel.DEBUG,
        stream: fs.createWriteStream(logfile),
        prefix: level => `[${new Date().toISOString()}] [${getLoggerLevelName(level)}] `,
      },
    ],
  });


  const app = getApp(logger);
  const server = http.createServer(app);

  server.listen(8080, () =>
    logger.info(chalk`Listening on port {yellow ${(server.address()).port}}`)
  );

  for (const signal of [
    "SIGABRT",
    "SIGHUP",
    "SIGINT",
    "SIGQUIT",
    "SIGTERM",
    "SIGUSR1",
    "SIGUSR2",
    "SIGBREAK",
  ]) {
    process.on(signal, () => {
      if (signal === "SIGINT" && process.stdout.isTTY) {
        // We clear the line to get rid of nasty ^C characters.
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
      }
      logger.info(chalk`Recieved signal {yellow ${signal}}`);
      process.exit();
    });
  }

  process.on("uncaughtException", (err) => {
    logger.fatal(chalk`An uncaught exception occurred: {red ${err.message}}`);
    err.stack
      ?.split("\n")
      .forEach((line, index) => index && logger.fatal(line)); // Skips index == 0
    process.exit(1);
  });

  process.on("exit", (code) => {
    logger.info(chalk`Exiting with code {yellow ${code}}`);
    server.close((err) => {
      if (err) {
        logger.error("Server emitted error when closing:", err);
      }
      logger.info("Server closed.");
      server.unref();
    });
  });
}();