import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { checkout } from "./search";

const http = httpRouter();

http.route({
  path: "/search/checkout",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })),
});

http.route({ path: "/search/checkout", method: "POST", handler: checkout });

export default http;
