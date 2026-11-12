
import { createServer } from "node:http";
import handler from "./api/generate-cover.js";

const server = createServer(async (req, res) => {
  const response = {
    statusCode: 200,

    setHeader(name, value) {
      res.setHeader(name, value);
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      res.statusCode = this.statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    },

    end(data) {
      res.statusCode = this.statusCode;
      res.end(data);
    },
  };

  try {
    let rawBody = "";

    for await (const chunk of req) {
      rawBody += chunk.toString();

      if (rawBody.length > 1_000_000) {
        response.status(413).json({ error: "Request body too large." });
        return;
      }
    }

    req.body = rawBody ? JSON.parse(rawBody) : {};

    await handler(req, response);
  } catch (error) {
    console.error("Local API error:", error);

    if (!res.headersSent) {
      response.status(500).json({
        error: error.message || "Local API encountered an error.",
      });
    }
  }
});

server.listen(8787, "127.0.0.1", () => {
  console.log("Local image API running at http://localhost:8787");
});
